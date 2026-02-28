"""Stats repository — aggregate-only queries, read-only, never mutates sessions."""

from datetime import UTC, datetime, timedelta

from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel


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


class PublicStats(BaseModel):
    total_sessions: int
    active_sessions: int
    sessions_by_phase: list[PhaseCount]
    sessions_per_day: list[DailyCount]
    total_cards: int
    avg_cards_per_session: float
    total_votes: int
    total_reactions: int


class AdminStats(BaseModel):
    reaction_breakdown: list[ReactionCount]
    cards_per_column: list[ColumnCount]
    activity_heatmap: list[HeatmapCell]
    engagement_funnel: FunnelStats


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

    async def get_admin_stats(self) -> AdminStats:
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

        return AdminStats(
            reaction_breakdown=reaction_breakdown,
            cards_per_column=cards_per_column,
            activity_heatmap=activity_heatmap,
            engagement_funnel=funnel,
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
    )
