import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/match.dart';
import '../providers/match_provider.dart';
import '../widgets/match_card.dart';
import '../widgets/league_section.dart';

/// Home screen with tabs for live/today/leagues
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  
  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    
    // Fetch matches on init
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<MatchProvider>().fetchMatches();
    });
  }
  
  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: _buildAppBar(),
      body: Column(
        children: [
          // Tab bar
          _buildTabBar(),
          
          // Tab content
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _LiveMatchesTab(),
                _TodayMatchesTab(),
                _LeaguesTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }
  
  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: AppColors.background,
      elevation: 0,
      title: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: AppColors.primaryGradient,
              ),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.sports_soccer,
              color: AppColors.background,
              size: 20,
            ),
          ),
          const SizedBox(width: 10),
          const Text(
            'LiveMatch',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
      centerTitle: true,
      actions: [
        IconButton(
          icon: const Icon(Icons.search, color: AppColors.textSecondary),
          onPressed: () {
            // TODO: Implement search
          },
        ),
        IconButton(
          icon: const Icon(Icons.notifications_outlined, color: AppColors.textSecondary),
          onPressed: () {
            // TODO: Implement notifications
          },
        ),
      ],
    );
  }
  
  Widget _buildTabBar() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: TabBar(
        controller: _tabController,
        indicator: BoxDecoration(
          gradient: const LinearGradient(
            colors: AppColors.primaryGradient,
          ),
          borderRadius: BorderRadius.circular(10),
        ),
        indicatorSize: TabBarIndicatorSize.tab,
        indicatorPadding: const EdgeInsets.all(4),
        labelColor: AppColors.background,
        unselectedLabelColor: AppColors.textSecondary,
        labelStyle: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
        tabs: const [
          Tab(text: 'LIVE'),
          Tab(text: 'TODAY'),
          Tab(text: 'LEAGUES'),
        ],
      ),
    );
  }
}

/// Live matches tab
class _LiveMatchesTab extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<MatchProvider>(
      builder: (context, provider, child) {
        return RefreshIndicator(
          color: AppColors.primary,
          backgroundColor: AppColors.surface,
          onRefresh: provider.refresh,
          child: _buildContent(provider),
        );
      },
    );
  }
  
  Widget _buildContent(MatchProvider provider) {
    if (provider.state == MatchListState.loading && provider.liveMatches.isEmpty) {
      return const _LoadingWidget();
    }
    
    if (provider.state == MatchListState.error && provider.liveMatches.isEmpty) {
      return _ErrorWidget(error: provider.error ?? 'Unknown error');
    }
    
    final liveMatches = provider.liveMatches;
    
    if (liveMatches.isEmpty) {
      return const _EmptyWidget(
        icon: Icons.sports_soccer,
        title: 'No Live Matches',
        subtitle: 'Check back later for live action',
      );
    }
    
    return ListView.builder(
      padding: const EdgeInsets.only(top: 8, bottom: 16),
      itemCount: liveMatches.length,
      itemBuilder: (context, index) {
        final match = liveMatches[index];
        return MatchCard(
          match: match,
          onTap: () => _navigateToPlayer(context, match),
        );
      },
    );
  }
}

/// Today's matches tab
class _TodayMatchesTab extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<MatchProvider>(
      builder: (context, provider, child) {
        return RefreshIndicator(
          color: AppColors.primary,
          backgroundColor: AppColors.surface,
          onRefresh: provider.refresh,
          child: _buildContent(provider),
        );
      },
    );
  }
  
  Widget _buildContent(MatchProvider provider) {
    if (provider.state == MatchListState.loading && provider.matches.isEmpty) {
      return const _LoadingWidget();
    }
    
    if (provider.state == MatchListState.error && provider.matches.isEmpty) {
      return _ErrorWidget(error: provider.error ?? 'Unknown error');
    }
    
    final todayMatches = provider.todayMatches;
    
    if (todayMatches.isEmpty) {
      return const _EmptyWidget(
        icon: Icons.event,
        title: 'No Matches Today',
        subtitle: 'Check other dates for upcoming matches',
      );
    }
    
    // Group by league
    final grouped = MatchGrouper.groupByLeague(todayMatches);
    final leagues = grouped.keys.toList();
    
    return ListView.builder(
      padding: const EdgeInsets.only(top: 8, bottom: 16),
      itemCount: leagues.length,
      itemBuilder: (context, index) {
        final league = leagues[index];
        final matches = MatchGrouper.sortWithLiveFirst(grouped[league]!);
        final info = MatchGrouper.getLeagueInfo(matches);
        
        return LeagueSection(
          leagueName: league,
          leagueLogo: info?.logo,
          country: info?.country,
          matches: matches,
          onMatchTap: (match) => _navigateToPlayer(context, match),
        );
      },
    );
  }
}

/// Leagues tab
class _LeaguesTab extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<MatchProvider>(
      builder: (context, provider, child) {
        return RefreshIndicator(
          color: AppColors.primary,
          backgroundColor: AppColors.surface,
          onRefresh: provider.refresh,
          child: _buildContent(provider),
        );
      },
    );
  }
  
  Widget _buildContent(MatchProvider provider) {
    if (provider.state == MatchListState.loading && provider.matches.isEmpty) {
      return const _LoadingWidget();
    }
    
    if (provider.state == MatchListState.error && provider.matches.isEmpty) {
      return _ErrorWidget(error: provider.error ?? 'Unknown error');
    }
    
    final grouped = provider.matchesByLeague;
    final leagues = grouped.keys.toList()..sort();
    
    if (leagues.isEmpty) {
      return const _EmptyWidget(
        icon: Icons.emoji_events,
        title: 'No Leagues',
        subtitle: 'Matches will appear here when available',
      );
    }
    
    return ListView.builder(
      padding: const EdgeInsets.only(top: 8, bottom: 16),
      itemCount: leagues.length,
      itemBuilder: (context, index) {
        final league = leagues[index];
        final matches = MatchGrouper.sortWithLiveFirst(grouped[league]!);
        final info = MatchGrouper.getLeagueInfo(matches);
        
        return LeagueSection(
          leagueName: league,
          leagueLogo: info?.logo,
          country: info?.country,
          matches: matches,
          onMatchTap: (match) => _navigateToPlayer(context, match),
        );
      },
    );
  }
}

/// Loading widget
class _LoadingWidget extends StatelessWidget {
  const _LoadingWidget();
  
  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(
            color: AppColors.primary,
          ),
          SizedBox(height: 16),
          Text(
            'Loading matches...',
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }
}

/// Error widget
class _ErrorWidget extends StatelessWidget {
  final String error;
  
  const _ErrorWidget({required this.error});
  
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.error_outline,
              size: 64,
              color: AppColors.error,
            ),
            const SizedBox(height: 16),
            const Text(
              'Something went wrong',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              error,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 14,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => context.read<MatchProvider>().fetchMatches(),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Empty state widget
class _EmptyWidget extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  
  const _EmptyWidget({
    required this.icon,
    required this.title,
    required this.subtitle,
  });
  
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            icon,
            size: 64,
            color: AppColors.textTertiary,
          ),
          const SizedBox(height: 16),
          Text(
            title,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 14,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

/// Navigate to player screen
void _navigateToPlayer(BuildContext context, Match match) {
  // TODO: Implement navigation to player screen
  // Navigator.push(
  //   context,
  //   MaterialPageRoute(
  //     builder: (context) => PlayerScreen(match: match),
  //   ),
  // );
}
