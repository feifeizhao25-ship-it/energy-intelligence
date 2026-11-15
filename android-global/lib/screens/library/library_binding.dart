import '../../services/api_service.dart';
import 'library_live.dart';

/// Connects the library page to this app's API client. The server wraps every reply as {code, message, data};
/// the page works with the inner `data` map.
Map<String, dynamic> _data(Map<String, dynamic> reply) {
  final d = reply['data'];
  return d is Map ? Map<String, dynamic>.from(d) : <String, dynamic>{};
}

LibraryLiveApi energyLibraryLiveApi() => LibraryLiveApi(
      entries: () async => _data(await ApiService.getLibraryEntries()),
      feed: () async => _data(await ApiService.getLibraryFeed()),
      setPrefs: ApiService.setLibraryPrefs,
      visit: ApiService.libraryVisit,
      opened: ApiService.libraryOpened,
    );
