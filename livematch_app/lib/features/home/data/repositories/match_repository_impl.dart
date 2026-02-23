import 'package:dio/dio.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/entities/match.dart';
import '../models/match_model.dart';

/// Repository for match data
abstract class MatchRepository {
  /// Get live matches
  Future<List<Match>> getLiveMatches();
  
  /// Get today's matches
  Future<List<Match>> getTodayMatches();
  
  /// Get matches by date
  Future<List<Match>> getMatchesByDate(DateTime date);
  
  /// Get matches by league
  Future<List<Match>> getMatchesByLeague(String leagueId);
  
  /// Get match details
  Future<Match> getMatchDetails(String matchId);
  
  /// Get stream URL for a match
  Future<String> getStreamUrl(String matchId, String serverId);
}

/// Implementation of MatchRepository
class MatchRepositoryImpl implements MatchRepository {
  final ApiClient _apiClient;
  
  MatchRepositoryImpl(this._apiClient);
  
  @override
  Future<List<Match>> getLiveMatches() async {
    try {
      final response = await _apiClient.get('/api/matches/live');
      
      final List<dynamic> data = response.data['matches'] ?? response.data;
      return data.map((json) => MatchModel.fromJson(json)).toList();
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }
  
  @override
  Future<List<Match>> getTodayMatches() async {
    try {
      final response = await _apiClient.get('/api/matches/today');
      
      final List<dynamic> data = response.data['matches'] ?? response.data;
      return data.map((json) => MatchModel.fromJson(json)).toList();
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }
  
  @override
  Future<List<Match>> getMatchesByDate(DateTime date) async {
    try {
      final dateStr = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
      final response = await _apiClient.get('/api/matches/$dateStr');
      
      final List<dynamic> data = response.data['matches'] ?? response.data;
      return data.map((json) => MatchModel.fromJson(json)).toList();
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }
  
  @override
  Future<List<Match>> getMatchesByLeague(String leagueId) async {
    try {
      final response = await _apiClient.get('/api/leagues/$leagueId/matches');
      
      final List<dynamic> data = response.data['matches'] ?? response.data;
      return data.map((json) => MatchModel.fromJson(json)).toList();
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }
  
  @override
  Future<Match> getMatchDetails(String matchId) async {
    try {
      final response = await _apiClient.get('/api/matches/$matchId');
      
      return MatchModel.fromJson(response.data);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }
  
  @override
  Future<String> getStreamUrl(String matchId, String serverId) async {
    try {
      final response = await _apiClient.get('/api/matches/$matchId/stream/$serverId');
      
      return response.data['url'] ?? response.data['streamUrl'];
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }
  
  Exception _handleError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return Exception('Connection timeout. Please check your internet connection.');
      case DioExceptionType.connectionError:
        return Exception('No internet connection.');
      case DioExceptionType.badResponse:
        final statusCode = error.response?.statusCode;
        if (statusCode == 404) {
          return Exception('Match not found.');
        } else if (statusCode == 403) {
          return Exception('Access denied. Please update your app.');
        }
        return Exception('Server error. Please try again later.');
      default:
        return Exception('An unexpected error occurred.');
    }
  }
}
