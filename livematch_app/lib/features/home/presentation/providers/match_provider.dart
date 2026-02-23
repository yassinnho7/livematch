import 'package:flutter/foundation.dart';
import '../../domain/entities/match.dart';
import '../../data/repositories/match_repository_impl.dart';
import '../../../../core/network/api_client.dart';

/// State for match list
enum MatchListState {
  initial,
  loading,
  loaded,
  error,
}

/// Provider for managing match state
class MatchProvider extends ChangeNotifier {
  final MatchRepositoryImpl _repository;
  
  MatchProvider() : _repository = MatchRepositoryImpl(ApiClient());
  
  // State
  MatchListState _state = MatchListState.initial;
  List<Match> _matches = [];
  List<Match> _liveMatches = [];
  String? _error;
  DateTime _selectedDate = DateTime.now();
  
  // Getters
  MatchListState get state => _state;
  List<Match> get matches => _matches;
  List<Match> get liveMatches => _liveMatches;
  String? get error => _error;
  DateTime get selectedDate => _selectedDate;
  
  /// Get matches for selected date
  List<Match> get todayMatches {
    final today = DateTime.now();
    return _matches.where((m) {
      return m.startTime.year == today.year &&
          m.startTime.month == today.month &&
          m.startTime.day == today.day;
    }).toList();
  }
  
  /// Get matches grouped by league
  Map<String, List<Match>> get matchesByLeague {
    final Map<String, List<Match>> grouped = {};
    for (final match in _matches) {
      grouped.putIfAbsent(match.league, () => []);
      grouped[match.league]!.add(match);
    }
    return grouped;
  }
  
  /// Fetch all matches
  Future<void> fetchMatches() async {
    _state = MatchListState.loading;
    _error = null;
    notifyListeners();
    
    try {
      // Fetch both live and today's matches in parallel
      final results = await Future.wait([
        _repository.getLiveMatches(),
        _repository.getTodayMatches(),
      ]);
      
      _liveMatches = results[0];
      
      // Merge and deduplicate
      final allMatches = <String, Match>{};
      for (final match in results[0]) {
        allMatches[match.id] = match;
      }
      for (final match in results[1]) {
        allMatches[match.id] = match;
      }
      
      _matches = allMatches.values.toList();
      _matches.sort((a, b) {
        // Live matches first
        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;
        // Then by time
        return a.startTime.compareTo(b.startTime);
      });
      
      _state = MatchListState.loaded;
    } catch (e) {
      _error = e.toString();
      _state = MatchListState.error;
    }
    
    notifyListeners();
  }
  
  /// Fetch matches for a specific date
  Future<void> fetchMatchesByDate(DateTime date) async {
    _selectedDate = date;
    _state = MatchListState.loading;
    _error = null;
    notifyListeners();
    
    try {
      _matches = await _repository.getMatchesByDate(date);
      _matches.sort((a, b) => a.startTime.compareTo(b.startTime));
      _state = MatchListState.loaded;
    } catch (e) {
      _error = e.toString();
      _state = MatchListState.error;
    }
    
    notifyListeners();
  }
  
  /// Refresh matches
  Future<void> refresh() async {
    await fetchMatches();
  }
  
  /// Get stream URL for a match
  Future<String> getStreamUrl(String matchId, String serverId) async {
    return await _repository.getStreamUrl(matchId, serverId);
  }
  
  /// Clear error
  void clearError() {
    _error = null;
    notifyListeners();
  }
}
