/* Maps each parity screen name to the design component that draws it, so the reference renderer can
   draw one artboard on its own, at its exact size. The components live in the design's screens/*.jsx. */
const PARITY_BOARDS = {};

// one light and one dark board from a single renderer: `<name>-light` and `<name>-dark`
const both = (name, render) => {
  PARITY_BOARDS[`${name}-light`] = () => render(false);
  PARITY_BOARDS[`${name}-dark`] = () => render(true);
};

both('home', (dark) => <HomePage dark={dark} />);
PARITY_BOARDS['home-cs-brand'] = () => <HomePage dark={false} />;

PARITY_BOARDS['join-light'] = () => <JoinOverlay dark={false} />;
PARITY_BOARDS['join-dark-taken'] = () => <JoinOverlay dark error />;

both('board-collecting', (dark) => <BoardV2 dark={dark} phase="Collecting" />);
both('board-discussing', (dark) => <BoardV2 dark={dark} phase="Discussing" />);
both('board-closed', (dark) => <BoardV2 dark={dark} phase="Closed" />);
both('board-share', (dark) => <BoardV2 dark={dark} phase="Discussing" shareOpen shareUrl="127.0.0.1:5199/session/ad9aaaea-758c-4e27-a70d-169ff1b6cd90" />);
both('board-actions', (dark) => <BoardV2 dark={dark} phase="Discussing" actionsOpen />);
both('board-menu', (dark) => <BoardV2 dark={dark} phase="Discussing" menuOpen />);
PARITY_BOARDS['board-cs-brand'] = () => <BoardV2 dark={false} phase="Discussing" collab />;

both('present-collecting', (dark) => <PresentBoard dark={dark} phase="Collecting" height={600} />);
both('present-discussing', (dark) => <PresentBoard dark={dark} phase="Discussing" timer height={760} />);
both('present-closed', (dark) => <PresentBoard dark={dark} phase="Closed" height={720} />);

both('m-discussing', (dark) => <MBoard dark={dark} phase="Discussing" />);
both('m-collecting', (dark) => <MBoard dark={dark} phase="Collecting" />);
both('m-timer', (dark) => <MBoard dark={dark} phase="Discussing" timer="running" role="participant" />);
both('m-share', (dark) => <MBoard dark={dark} phase="Discussing" sharing />);
both('m-notification', (dark) => <MBoard dark={dark} phase="Discussing" notification />);
both('m-present', (dark) => <MPresent dark={dark} />);
both('m-card-move', (dark) => <MCardMove dark={dark} />);
both('m-stats', (dark) => <MStats dark={dark} />);

both('chosen-participant', (dark) => <BoardV2 dark={dark} phase="Discussing" role="participant" timer="running" />);
PARITY_BOARDS['chosen-share-light'] = () => <BoardV2 dark={false} phase="Discussing" shareOpen />;
PARITY_BOARDS['chosen-timer-menu-dark'] = () => <BoardV2 dark phase="Discussing" timerMenu />;
PARITY_BOARDS['chosen-running-light'] = () => <BoardV2 dark={false} phase="Discussing" timer="running" />;
PARITY_BOARDS['chosen-time-up-dark'] = () => <BoardV2 dark phase="Discussing" timer="up" />;

both('dock', (dark) => <DockScene dark={dark} />);
both('settings', (dark) => <SettingsDialog dark={dark} />);
both('help', (dark) => <HelpDialog dark={dark} />);
both('history', (dark) => <HistorySidebar dark={dark} />);
both('notes', (dark) => <NotesSidebar dark={dark} />);

both('stats', (dark) => <StatsPageV2 dark={dark} />);
both('admin', (dark) => <AdminPage dark={dark} />);
PARITY_BOARDS['admin-locked-light'] = () => <AdminPage dark={false} locked />;
both('privacy', (dark) => <PrivacyPage dark={dark} />);
both('feedback-page', (dark) => <FeedbackPage dark={dark} />);
both('not-found', (dark) => <NotFoundPage dark={dark} />);
both('changelog', (dark) => <ChangelogPage dark={dark} />);

window.PARITY_BOARDS = PARITY_BOARDS;
