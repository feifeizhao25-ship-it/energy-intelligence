// 资料库页面的英文文字（国际版专用）。国内版不包含这个文件，避免英文进入国内版界面。
import 'library_live.dart';
import 'reference_library_page.dart';

String _enDate(String d) {
  final m = RegExp(r'^(\d{4})-(\d{2})(?:-(\d{2}))?$').firstMatch(d);
  if (m == null) return d;
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  final month = names[int.parse(m.group(2)!) - 1];
  if (m.group(3) == null) return '$month ${m.group(1)}';
  return '$month ${int.parse(m.group(3)!)}, ${m.group(1)}';
}


/// 国际版文字（英文）。
LibraryStrings libraryStringsEn({required String title, required String intro, required String footer}) => LibraryStrings(
      title: title,
      intro: intro,
      searchHint: 'Search keywords',
      allLabel: 'All',
      statusAll: 'All statuses',
      statusLabels: const ['In force', 'Proposed', 'Repealed', 'Unverified'],
      pendingLabel: 'Pending review',
      approvedLabel: 'Reviewed',
      previewBanner: 'Preview mode: these entries were written from the official text but are still waiting for human review. Do not treat them as final.',
      emptyReviewTitle: 'Entries are under review',
      emptyReviewBody: 'New entries are checked against the original document by a person before they appear here. Until then, rely on the official publication.',
      emptySearchTitle: 'Nothing matches',
      emptySearchBody: 'Try another keyword, or clear the category and status filters.',
      loading: 'Loading…',
      loadFailed: 'Could not load the library',
      retry: 'Retry',
      countLabel: (n) => n == 1 ? '1 entry' : '$n entries',
      sourceLabel: 'Source',
      publishedLabel: 'Published',
      retrievedLabel: 'Retrieved',
      effectiveLabel: 'Effective',
      pointsTitle: 'Key points',
      tipTitle: 'In plain words',
      cautionTitle: 'Please note',
      sourceTitle: 'Source',
      fileLabel: 'Document',
      publisherLabel: 'Publisher',
      docNoLabel: 'Reference',
      readScopeLabel: 'What was read',
      linkLabel: 'Original',
      openSource: 'Open the official text',
      copyLink: 'Copy link to the original',
      copiedHint: 'Link copied. Paste it into a browser to open it.',
      statusNoteLabel: 'Status note',
      footer: footer,
      formatDate: _enDate,
      live: kLiveStringsEn,
      colon: ': ',
    );

const LiveStrings kLiveStringsEn = LiveStrings(
  forYouTitle: 'For you',
  whyLabel: 'Why you see this',
  newBadge: 'New',
  updatedBadge: 'Updated',
  settingsTitle: 'Recommendation settings',
  settingsTooltip: 'Recommendation settings',
  switchTitle: 'Personalised picks',
  switchOnHint: 'Picks use your role, region, the topics you follow and what you have read. They only appear in the app; nothing is sent to you.',
  switchOffTitle: 'Personalised picks are off',
  switchOffBody: 'We are not choosing entries for you or recording what you read. You can turn this on again at any time.',
  topicsTitle: 'Topics you follow',
  topicsHint: 'Tap to follow; new and updated entries on these topics come first. Long-press to stop seeing a topic.',
  followAction: 'Follow',
  followedState: 'Following',
  mutedState: 'Hidden',
  muteAction: 'Hide this topic',
  unmuteAction: 'Show this topic',
  changeNoteLabel: 'What changed',
  offlineNote: 'You are seeing the copy saved in the app. It updates automatically when you are online.',
  nothingForYou: 'Nothing new for you right now',
  close: 'Done',
  saveFailed: 'Could not save. Please try again.',
  moreInLibrary: 'All entries',
  colon: ': ',
);
