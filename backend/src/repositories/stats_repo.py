"""Stats repository — aggregate-only queries, read-only, never mutates sessions."""

from datetime import UTC, datetime, timedelta

from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

BUCKET_ORDER = ["<1 day", "1–7 days", "7–30 days", "30+ days"]


class PhaseCount(BaseModel):
    phase: str
    count: int


class DailyCount(BaseModel):
    date: str  # "YYYY-MM-DD"
    count: int


class ReactionCount(BaseModel):
    emoji: str
    count: int


class ColumnCount(BaseModel):
    column: str
    count: int


class HeatmapCell(BaseModel):
    day_of_week: int
    hour_bucket: int
    count: int


class FunnelStats(BaseModel):
    created: int
    has_cards: int
    has_votes: int
    closed: int


class LifetimeBucket(BaseModel):
    label: str  # "<1 day" | "1–7 days" | "7–30 days" | "30+ days"
    count: int


class ExpiryCountdown(BaseModel):
    expiring_within_7_days: int
    expiring_within_30_days: int


class AvgDurationByPhase(BaseModel):
    open_avg_hours: float | None   # None = no open sessions
    closed_avg_hours: float | None  # None = no closed sessions


class SessionLifetimeStats(BaseModel):
    expiry_countdown: ExpiryCountdown
    lifetime_distribution: list[LifetimeBucket]  # always 4 entries
    avg_duration: AvgDurationByPhase
    avg_time_to_close_hours: float | None  # None = no closed sessions


class PublicStats(BaseModel):
    total_sessions: int
    active_sessions: int
    sessions_by_phase: list[PhaseCount]
    sessions_per_day: list[DailyCount]
    total_cards: int
    avg_cards_per_session: float
    total_votes: int
    total_reactions: int


class SentryIssue(BaseModel):
    id: str
    title: str
    count: int
    last_seen: str  # ISO string from Sentry


class SentryDataPoint(BaseModel):
    date: str       # "YYYY-MM-DD"
    value: float | None


class SentryHealth(BaseModel):
    unresolved_count: int
    top_issues: list[SentryIssue]
    error_rate_7d: list[SentryDataPoint]   # errors per day
    p95_latency_7d: list[SentryDataPoint]  # ms per day
    error: str | None = None               # set on partial fetch failure


class AdminStats(BaseModel):
    reaction_breakdown: list[ReactionCount]
    cards_per_column: list[ColumnCount]
    activity_heatmap: list[HeatmapCell]
    engagement_funnel: FunnelStats
    session_lifetime: SessionLifetimeStats
    sentry: SentryHealth | None = None


class StatsRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.collection = db["sessions"]

    async def get_public_stats(self) -> PublicStats:
        thirty_days_ago = datetime.now(UTC) - timedelta(days=30)

        pipeline: list[dict] = [
            {
                "$facet": {
                    "total": [{"$count": "n"}],
                    "active": [
                        {"$match": {"phase": {"$ne": "closed"}}},
                        {"$count": "n"},
                    ],
                    "by_phase": [
                        {"$group": {"_id": "$phase", "count": {"$sum": 1}}},
                        {"$sort": {"_id": 1}},
                    ],
                    "per_day": [
                        {"$match": {"created_at": {"$gte": thirty_days_ago}}},
                        {
                            "$group": {
                                "_id": {
                                    "$dateToString": {
                                        "format": "%Y-%m-%d",
                                        "date": "$created_at",
                                    }
                                },
                                "count": {"$sum": 1},
                            }
                        },
                        {"$sort": {"_id": 1}},
                    ],
                    "card_counts": [
                        {
                            "$unwind": {
                                "path": "$cards",
                                "preserveNullAndEmptyArrays": False,
                            }
                        },
                        {"$count": "total"},
                    ],
                    "vote_counts": [
                        {
                            "$unwind": {
                                "path": "$cards",
                                "preserveNullAndEmptyArrays": False,
                            }
                        },
                        {
                            "$unwind": {
                                "path": "$cards.votes",
                                "preserveNullAndEmptyArrays": False,
                            }
                        },
                        {"$count": "total"},
                    ],
                    "reaction_counts": [
                        {
                            "$unwind": {
                                "path": "$cards",
                                "preserveNullAndEmptyArrays": False,
                            }
                        },
                        {
                            "$unwind": {
                                "path": "$cards.reactions",
                                "preserveNullAndEmptyArrays": False,
                            }
                        },
                        {"$count": "total"},
                    ],
                }
            }
        ]

        result = await self.collection.aggregate(pipeline).to_list(length=1)
        if not result:
            return _empty_public_stats()

        facets = result[0]
        total = facets["total"][0]["n"] if facets["total"] else 0
        active = facets["active"][0]["n"] if facets["active"] else 0
        by_phase = [
            PhaseCount(phase=d["_id"], count=d["count"]) for d in facets["by_phase"]
        ]
        per_day = [
            DailyCount(date=d["_id"], count=d["count"]) for d in facets["per_day"]
        ]
        total_cards = facets["card_counts"][0]["total"] if facets["card_counts"] else 0
        total_votes = facets["vote_counts"][0]["total"] if facets["vote_counts"] else 0
        total_reactions = (
            facets["reaction_counts"][0]["total"] if facets["reaction_counts"] else 0
        )
        avg = round(total_cards / total, 2) if total > 0 else 0.0

        return PublicStats(
            total_sessions=total,
            active_sessions=active,
            sessions_by_phase=by_phase,
            sessions_per_day=per_day,
            total_cards=total_cards,
            avg_cards_per_session=avg,
            total_votes=total_votes,
            total_reactions=total_reactions,
        )

    async def get_admin_stats(self, expiry_days: int = 30) -> AdminStats:
        # Use naive UTC for pipeline constants — MongoDB stores datetimes as UTC without tzinfo,
        # and $subtract arithmetic requires both operands to have the same tzinfo status.
        now = datetime.now(UTC).replace(tzinfo=None)
        expiry_delta = timedelta(days=expiry_days)

        pipeline: list[dict] = [
            {
                "$facet": {
                    "reaction_breakdown": [
                        {
                            "$unwind": {
                                "path": "$cards",
                                "preserveNullAndEmptyArrays": False,
                            }
                        },
                        {
                            "$unwind": {
                                "path": "$cards.reactions",
                                "preserveNullAndEmptyArrays": False,
                            }
                        },
                        {
                            "$group": {
                                "_id": "$cards.reactions.emoji",
                                "count": {"$sum": 1},
                            }
                        },
                        {"$sort": {"count": -1}},
                    ],
                    "cards_per_column": [
                        {
                            "$unwind": {
                                "path": "$cards",
                                "preserveNullAndEmptyArrays": False,
                            }
                        },
                        {
                            "$group": {
                                "_id": "$cards.column",
                                "count": {"$sum": 1},
                            }
                        },
                        {"$sort": {"count": -1}},
                    ],
                    "activity_heatmap": [
                        {
                            "$addFields": {
                                "dow": {"$dayOfWeek": "$created_at"},
                                "hour": {"$hour": "$created_at"},
                            }
                        },
                        {
                            "$group": {
                                "_id": {"dow": "$dow", "hour": "$hour"},
                                "count": {"$sum": 1},
                            }
                        },
                        {"$sort": {"_id.dow": 1, "_id.hour": 1}},
                    ],
                    "funnel_created": [{"$count": "n"}],
                    "funnel_has_cards": [
                        {"$match": {"cards.0": {"$exists": True}}},
                        {"$count": "n"},
                    ],
                    "funnel_has_votes": [
                        {
                            "$match": {
                                "cards": {
                                    "$elemMatch": {"votes.0": {"$exists": True}}
                                }
                            }
                        },
                        {"$count": "n"},
                    ],
                    "funnel_closed": [
                        {"$match": {"phase": "closed"}},
                        {"$count": "n"},
                    ],
                    # Sessions expiring within 7 days: created_at in (now-expiry, now-expiry+7d]
                    "expiry_7": [
                        {
                            "$match": {
                                "phase": {"$ne": "closed"},
                                "created_at": {
                                    "$gt": now - expiry_delta,
                                    "$lte": now - expiry_delta + timedelta(days=7),
                                },
                            }
                        },
                        {"$count": "n"},
                    ],
                    # All non-expired, non-closed sessions (within 30 days of expiry)
                    "expiry_30": [
                        {
                            "$match": {
                                "phase": {"$ne": "closed"},
                                "created_at": {"$gt": now - expiry_delta},
                            }
                        },
                        {"$count": "n"},
                    ],
                    # Lifetime distribution: bucket by age (now - created_at) in hours
                    # Uses $subtract (ms diff) / 3600000 — broadly supported vs $dateDiff (Mongo 5.0+)
                    "lifetime_dist": [
                        {
                            "$addFields": {
                                "age_hours": {
                                    "$divide": [
                                        {"$subtract": [now, "$created_at"]},
                                        3_600_000,
                                    ]
                                }
                            }
                        },
                        {
                            "$group": {
                                "_id": {
                                    "$switch": {
                                        "branches": [
                                            {
                                                "case": {"$lt": ["$age_hours", 24]},
                                                "then": "<1 day",
                                            },
                                            {
                                                "case": {"$lt": ["$age_hours", 168]},
                                                "then": "1–7 days",
                                            },
                                            {
                                                "case": {"$lt": ["$age_hours", 720]},
                                                "then": "7–30 days",
                                            },
                                        ],
                                        "default": "30+ days",
                                    }
                                },
                                "count": {"$sum": 1},
                            }
                        },
                    ],
                    # Avg duration (created_at → last_accessed_at) by open/closed
                    "avg_duration_open": [
                        {"$match": {"phase": {"$ne": "closed"}}},
                        {
                            "$addFields": {
                                "h": {
                                    "$divide": [
                                        {"$subtract": ["$last_accessed_at", "$created_at"]},
                                        3_600_000,
                                    ]
                                }
                            }
                        },
                        {"$group": {"_id": None, "avg": {"$avg": "$h"}}},
                    ],
                    "avg_duration_closed": [
                        {"$match": {"phase": "closed"}},
                        {
                            "$addFields": {
                                "h": {
                                    "$divide": [
                                        {"$subtract": ["$last_accessed_at", "$created_at"]},
                                        3_600_000,
                                    ]
                                }
                            }
                        },
                        {"$group": {"_id": None, "avg": {"$avg": "$h"}}},
                    ],
                    # Avg time to close: created_at → updated_at (closed sessions only)
                    "time_to_close": [
                        {"$match": {"phase": "closed"}},
                        {
                            "$addFields": {
                                "h": {
                                    "$divide": [
                                        {"$subtract": ["$updated_at", "$created_at"]},
                                        3_600_000,
                                    ]
                                }
                            }
                        },
                        {"$group": {"_id": None, "avg": {"$avg": "$h"}}},
                    ],
                }
            }
        ]

        result = await self.collection.aggregate(pipeline).to_list(length=1)
        if not result:
            return _empty_admin_stats()

        facets = result[0]

        reaction_breakdown = [
            ReactionCount(emoji=d["_id"], count=d["count"])
            for d in facets["reaction_breakdown"]
        ]
        cards_per_column = [
            ColumnCount(column=d["_id"], count=d["count"])
            for d in facets["cards_per_column"]
        ]
        activity_heatmap = [
            HeatmapCell(
                day_of_week=d["_id"]["dow"],
                hour_bucket=d["_id"]["hour"],
                count=d["count"],
            )
            for d in facets["activity_heatmap"]
        ]
        funnel = FunnelStats(
            created=facets["funnel_created"][0]["n"] if facets["funnel_created"] else 0,
            has_cards=(
                facets["funnel_has_cards"][0]["n"] if facets["funnel_has_cards"] else 0
            ),
            has_votes=(
                facets["funnel_has_votes"][0]["n"] if facets["funnel_has_votes"] else 0
            ),
            closed=facets["funnel_closed"][0]["n"] if facets["funnel_closed"] else 0,
        )

        # Lifetime distribution — always emit 4 ordered buckets
        dist_map = {d["_id"]: d["count"] for d in facets["lifetime_dist"]}
        lifetime_distribution = [
            LifetimeBucket(label=label, count=dist_map.get(label, 0))
            for label in BUCKET_ORDER
        ]

        # Avg duration by phase
        open_raw = facets["avg_duration_open"][0]["avg"] if facets["avg_duration_open"] else None
        closed_raw = facets["avg_duration_closed"][0]["avg"] if facets["avg_duration_closed"] else None
        avg_duration = AvgDurationByPhase(
            open_avg_hours=round(open_raw, 2) if open_raw is not None else None,
            closed_avg_hours=round(closed_raw, 2) if closed_raw is not None else None,
        )

        # Avg time to close
        ttc_raw = facets["time_to_close"][0]["avg"] if facets["time_to_close"] else None
        avg_time_to_close = round(ttc_raw, 2) if ttc_raw is not None else None

        session_lifetime = SessionLifetimeStats(
            expiry_countdown=ExpiryCountdown(
                expiring_within_7_days=(
                    facets["expiry_7"][0]["n"] if facets["expiry_7"] else 0
                ),
                expiring_within_30_days=(
                    facets["expiry_30"][0]["n"] if facets["expiry_30"] else 0
                ),
            ),
            lifetime_distribution=lifetime_distribution,
            avg_duration=avg_duration,
            avg_time_to_close_hours=avg_time_to_close,
        )

        return AdminStats(
            reaction_breakdown=reaction_breakdown,
            cards_per_column=cards_per_column,
            activity_heatmap=activity_heatmap,
            engagement_funnel=funnel,
            session_lifetime=session_lifetime,
        )


def _empty_public_stats() -> PublicStats:
    return PublicStats(
        total_sessions=0,
        active_sessions=0,
        sessions_by_phase=[],
        sessions_per_day=[],
        total_cards=0,
        avg_cards_per_session=0.0,
        total_votes=0,
        total_reactions=0,
    )


def _empty_admin_stats() -> AdminStats:
    return AdminStats(
        reaction_breakdown=[],
        cards_per_column=[],
        activity_heatmap=[],
        engagement_funnel=FunnelStats(created=0, has_cards=0, has_votes=0, closed=0),
        session_lifetime=SessionLifetimeStats(
            expiry_countdown=ExpiryCountdown(
                expiring_within_7_days=0,
                expiring_within_30_days=0,
            ),
            lifetime_distribution=[
                LifetimeBucket(label=label, count=0) for label in BUCKET_ORDER
            ],
            avg_duration=AvgDurationByPhase(
                open_avg_hours=None,
                closed_avg_hours=None,
            ),
            avg_time_to_close_hours=None,
        ),
    )
