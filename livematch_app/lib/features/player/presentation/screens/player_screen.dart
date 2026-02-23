import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';
import 'package:chewie/chewie.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../home/domain/entities/match.dart';

/// Video player screen with HLS support
class PlayerScreen extends StatefulWidget {
  final Match match;
  final String? initialServerId;
  
  const PlayerScreen({
    super.key,
    required this.match,
    this.initialServerId,
  });
  
  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  VideoPlayerController? _videoController;
  ChewieController? _chewieController;
  bool _isLoading = true;
  String? _error;
  StreamServer? _selectedServer;
  String? _streamUrl;
  bool _showControls = true;
  bool _isFullscreen = false;
  
  @override
  void initState() {
    super.initState();
    _initializePlayer();
    
    // Set landscape orientation for player
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
      DeviceOrientation.portraitUp,
    ]);
  }
  
  @override
  void dispose() {
    _videoController?.dispose();
    _chewieController?.dispose();
    
    // Reset orientation
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
    ]);
    
    super.dispose();
  }
  
  Future<void> _initializePlayer() async {
    if (widget.match.servers.isEmpty) {
      setState(() {
        _error = 'No streams available';
        _isLoading = false;
      });
      return;
    }
    
    // Select initial server
    _selectedServer = widget.initialServerId != null
        ? widget.match.servers.firstWhere(
            (s) => s.id == widget.initialServerId,
            orElse: () => widget.match.servers.first,
          )
        : widget.match.servers.first;
    
    await _loadStream(_selectedServer!);
  }
  
  Future<void> _loadStream(StreamServer server) async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    
    try {
      // Get stream URL (in real app, fetch from API)
      // For now, use placeholder
      String url = server.url ?? 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
      
      // Create video controller
      _videoController = VideoPlayerController.networkUrl(
        Uri.parse(url),
        httpHeaders: {
          'Referer': 'https://livematch.pages.dev',
          'Origin': 'https://livematch.pages.dev',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      );
      
      await _videoController!.initialize();
      
      // Create Chewie controller
      _chewieController = ChewieController(
        videoPlayerController: _videoController!,
        autoPlay: true,
        looping: false,
        allowFullScreen: true,
        allowMuting: true,
        showControls: true,
        showControlsOnInitialize: true,
        placeholder: Container(
          color: AppColors.background,
          child: const Center(
            child: CircularProgressIndicator(
              color: AppColors.primary,
            ),
          ),
        ),
        errorBuilder: (context, errorMessage) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.error_outline,
                  color: AppColors.error,
                  size: 48,
                ),
                const SizedBox(height: 16),
                Text(
                  errorMessage,
                  style: const TextStyle(color: AppColors.textPrimary),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          );
        },
      );
      
      setState(() {
        _isLoading = false;
        _streamUrl = url;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }
  
  void _switchServer(StreamServer server) {
    _videoController?.pause();
    _chewieController?.dispose();
    _videoController?.dispose();
    _loadStream(server);
  }
  
  void _toggleFullscreen() {
    setState(() {
      _isFullscreen = !_isFullscreen;
    });
    
    if (_isFullscreen) {
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
      SystemChrome.setPreferredOrientations([
        DeviceOrientation.landscapeLeft,
        DeviceOrientation.landscapeRight,
      ]);
    } else {
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
      SystemChrome.setPreferredOrientations([
        DeviceOrientation.portraitUp,
      ]);
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Stack(
        children: [
          // Video player
          _buildVideoPlayer(),
          
          // Overlay controls
          if (_showControls) _buildOverlay(),
        ],
      ),
    );
  }
  
  Widget _buildVideoPlayer() {
    if (_isLoading) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(
              color: AppColors.primary,
            ),
            SizedBox(height: 16),
            Text(
              'Loading stream...',
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 14,
              ),
            ),
          ],
        ),
      );
    }
    
    if (_error != null) {
      return _buildErrorWidget();
    }
    
    if (_chewieController != null) {
      return Center(
        child: AspectRatio(
          aspectRatio: _videoController!.value.aspectRatio,
          child: Chewie(controller: _chewieController!),
        ),
      );
    }
    
    return const Center(
      child: Text(
        'No video available',
        style: TextStyle(color: AppColors.textSecondary),
      ),
    );
  }
  
  Widget _buildErrorWidget() {
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
              'Failed to load stream',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _error ?? 'Unknown error',
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 14,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            if (widget.match.servers.length > 1) ...[
              const Text(
                'Try another server:',
                style: TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                children: widget.match.servers.map((server) {
                  return _buildServerChip(server);
                }).toList(),
              ),
            ] else
              ElevatedButton(
                onPressed: () => _loadStream(_selectedServer!),
                child: const Text('Retry'),
              ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildOverlay() {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Colors.black.withOpacity(0.7),
              Colors.transparent,
            ],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                // Back button
                IconButton(
                  icon: const Icon(
                    Icons.arrow_back,
                    color: Colors.white,
                  ),
                  onPressed: () => Navigator.pop(context),
                ),
                
                // Match info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '${widget.match.homeTeam} vs ${widget.match.awayTeam}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (widget.match.isLive)
                        Container(
                          margin: const EdgeInsets.only(top: 4),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.live,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'LIVE',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                
                // Server selector
                if (widget.match.servers.length > 1)
                  _buildServerSelector(),
                
                // Fullscreen toggle
                IconButton(
                  icon: Icon(
                    _isFullscreen ? Icons.fullscreen_exit : Icons.fullscreen,
                    color: Colors.white,
                  ),
                  onPressed: _toggleFullscreen,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
  
  Widget _buildServerSelector() {
    return PopupMenuButton<StreamServer>(
      icon: const Icon(Icons.dns, color: Colors.white),
      onSelected: _switchServer,
      itemBuilder: (context) {
        return widget.match.servers.map((server) {
          final isSelected = server.id == _selectedServer?.id;
          return PopupMenuItem<StreamServer>(
            value: server,
            enabled: !isSelected,
            child: Row(
              children: [
                Icon(
                  Icons.circle,
                  size: 8,
                  color: isSelected ? AppColors.primary : AppColors.textTertiary,
                ),
                const SizedBox(width: 8),
                Text(
                  server.name,
                  style: TextStyle(
                    color: isSelected ? AppColors.primary : AppColors.textPrimary,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                  decoration: BoxDecoration(
                    color: server.isHD
                        ? AppColors.primary.withOpacity(0.2)
                        : AppColors.surfaceLight,
                    borderRadius: BorderRadius.circular(2),
                  ),
                  child: Text(
                    server.qualityBadge,
                    style: TextStyle(
                      color: server.isHD ? AppColors.primary : AppColors.textTertiary,
                      fontSize: 9,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                if (server.isPremium) ...[
                  const SizedBox(width: 4),
                  const Icon(
                    Icons.star,
                    size: 12,
                    color: AppColors.warning,
                  ),
                ],
              ],
            ),
          );
        }).toList();
      },
    );
  }
  
  Widget _buildServerChip(StreamServer server) {
    final isSelected = server.id == _selectedServer?.id;
    
    return GestureDetector(
      onTap: () => _switchServer(server),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : AppColors.surface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.divider,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              server.name,
              style: TextStyle(
                color: isSelected ? AppColors.background : AppColors.textPrimary,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(width: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
              decoration: BoxDecoration(
                color: server.isHD
                    ? (isSelected ? AppColors.background : AppColors.primary.withOpacity(0.2))
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(2),
              ),
              child: Text(
                server.qualityBadge,
                style: TextStyle(
                  color: server.isHD
                      ? (isSelected ? AppColors.primary : AppColors.primary)
                      : AppColors.textTertiary,
                  fontSize: 9,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
