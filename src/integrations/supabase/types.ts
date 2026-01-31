export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_analyses: {
        Row: {
          analysis_type: string | null
          confidence_scores: Json | null
          created_at: string
          frame_references: Json | null
          id: string
          insights: Json | null
          model_version: string | null
          processing_time_ms: number | null
          raw_output: Json | null
          recommendations: Json | null
          score: number | null
          session_id: string
          status: string | null
          summary: string | null
        }
        Insert: {
          analysis_type?: string | null
          confidence_scores?: Json | null
          created_at?: string
          frame_references?: Json | null
          id?: string
          insights?: Json | null
          model_version?: string | null
          processing_time_ms?: number | null
          raw_output?: Json | null
          recommendations?: Json | null
          score?: number | null
          session_id: string
          status?: string | null
          summary?: string | null
        }
        Update: {
          analysis_type?: string | null
          confidence_scores?: Json | null
          created_at?: string
          frame_references?: Json | null
          id?: string
          insights?: Json | null
          model_version?: string | null
          processing_time_ms?: number | null
          raw_output?: Json | null
          recommendations?: Json | null
          score?: number | null
          session_id?: string
          status?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_analyses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "capture_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      annotations: {
        Row: {
          annotation_type: string | null
          color: string | null
          content: string | null
          created_at: string
          end_timestamp_seconds: number | null
          id: string
          is_private: boolean | null
          session_id: string
          tags: string[] | null
          timestamp_seconds: number
          title: string | null
          updated_at: string | null
          user_id: string
          visibility: string | null
        }
        Insert: {
          annotation_type?: string | null
          color?: string | null
          content?: string | null
          created_at?: string
          end_timestamp_seconds?: number | null
          id?: string
          is_private?: boolean | null
          session_id: string
          tags?: string[] | null
          timestamp_seconds: number
          title?: string | null
          updated_at?: string | null
          user_id: string
          visibility?: string | null
        }
        Update: {
          annotation_type?: string | null
          color?: string | null
          content?: string | null
          created_at?: string
          end_timestamp_seconds?: number | null
          id?: string
          is_private?: boolean | null
          session_id?: string
          tags?: string[] | null
          timestamp_seconds?: number
          title?: string | null
          updated_at?: string | null
          user_id?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "annotations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "capture_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_tracks: {
        Row: {
          bitrate: number | null
          channels: number | null
          codec: string | null
          created_at: string
          duration_ms: number
          file_size_bytes: number | null
          id: string
          is_muted: boolean | null
          mime_type: string | null
          offset_ms: number | null
          sample_rate: number | null
          session_id: string
          status: string | null
          storage_path: string | null
          storage_url: string
          track_name: string | null
          track_type: string | null
          updated_at: string
          user_id: string
          video_asset_id: string | null
          volume_level: number | null
          waveform_data: Json | null
        }
        Insert: {
          bitrate?: number | null
          channels?: number | null
          codec?: string | null
          created_at?: string
          duration_ms?: number
          file_size_bytes?: number | null
          id?: string
          is_muted?: boolean | null
          mime_type?: string | null
          offset_ms?: number | null
          sample_rate?: number | null
          session_id: string
          status?: string | null
          storage_path?: string | null
          storage_url: string
          track_name?: string | null
          track_type?: string | null
          updated_at?: string
          user_id: string
          video_asset_id?: string | null
          volume_level?: number | null
          waveform_data?: Json | null
        }
        Update: {
          bitrate?: number | null
          channels?: number | null
          codec?: string | null
          created_at?: string
          duration_ms?: number
          file_size_bytes?: number | null
          id?: string
          is_muted?: boolean | null
          mime_type?: string | null
          offset_ms?: number | null
          sample_rate?: number | null
          session_id?: string
          status?: string | null
          storage_path?: string | null
          storage_url?: string
          track_name?: string | null
          track_type?: string | null
          updated_at?: string
          user_id?: string
          video_asset_id?: string | null
          volume_level?: number | null
          waveform_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audio_tracks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "capture_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_tracks_video_asset_id_fkey"
            columns: ["video_asset_id"]
            isOneToOne: false
            referencedRelation: "video_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_users: {
        Row: {
          blocked_user_id: string
          created_at: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          blocked_user_id: string
          created_at?: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          blocked_user_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      capture_sessions: {
        Row: {
          created_at: string
          deleted_at: string | null
          duration_seconds: number | null
          game_name: string | null
          id: string
          is_private: boolean | null
          metadata: Json | null
          status: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
          video_url: string | null
          visibility: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          duration_seconds?: number | null
          game_name?: string | null
          id?: string
          is_private?: boolean | null
          metadata?: Json | null
          status?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          user_id: string
          video_url?: string | null
          visibility?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          duration_seconds?: number | null
          game_name?: string | null
          id?: string
          is_private?: boolean | null
          metadata?: Json | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
          visibility?: string | null
        }
        Relationships: []
      }
      comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          reaction_type: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "social_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      community_annotations: {
        Row: {
          content: string
          created_at: string
          id: string
          is_hidden: boolean | null
          post_id: string
          tags: string[] | null
          timestamp_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_hidden?: boolean | null
          post_id: string
          tags?: string[] | null
          timestamp_seconds: number
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_hidden?: boolean | null
          post_id?: string
          tags?: string[] | null
          timestamp_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_annotations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          allow_comments: boolean
          allow_public_annotations: boolean
          allow_public_remixes: boolean
          author_id: string
          created_at: string
          description: string | null
          duration_seconds: number | null
          id: string
          session_id: string
          share_token: string | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string | null
          views_count: number | null
          visibility: string
        }
        Insert: {
          allow_comments?: boolean
          allow_public_annotations?: boolean
          allow_public_remixes?: boolean
          author_id: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          session_id: string
          share_token?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
          views_count?: number | null
          visibility?: string
        }
        Update: {
          allow_comments?: boolean
          allow_public_annotations?: boolean
          allow_public_remixes?: boolean
          author_id?: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          session_id?: string
          share_token?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
          views_count?: number | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "capture_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      community_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction_type: string
          timestamp_seconds: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reaction_type: string
          timestamp_seconds: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reaction_type?: string
          timestamp_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      connected_accounts: {
        Row: {
          connected_at: string
          display_handle: string | null
          encrypted_access_token: string | null
          encrypted_refresh_token: string | null
          id: string
          last_used_at: string | null
          provider: string
          provider_account_id: string
          provider_email: string | null
          provisioning_status: string | null
          token_expires_at: string | null
          user_id: string
        }
        Insert: {
          connected_at?: string
          display_handle?: string | null
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          id?: string
          last_used_at?: string | null
          provider: string
          provider_account_id: string
          provider_email?: string | null
          provisioning_status?: string | null
          token_expires_at?: string | null
          user_id: string
        }
        Update: {
          connected_at?: string
          display_handle?: string | null
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          id?: string
          last_used_at?: string | null
          provider?: string
          provider_account_id?: string
          provider_email?: string | null
          provisioning_status?: string | null
          token_expires_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      draw_annotations: {
        Row: {
          animation: string | null
          annotation_id: string | null
          created_at: string
          draw_type: string
          duration_ms: number | null
          end_x: number | null
          end_y: number | null
          fill_color: string | null
          font_family: string | null
          font_size: number | null
          height: number | null
          id: string
          opacity: number | null
          path_data: Json | null
          session_id: string
          start_x: number
          start_y: number
          stroke_color: string | null
          stroke_width: number | null
          text_content: string | null
          timestamp_ms: number
          updated_at: string
          user_id: string
          width: number | null
        }
        Insert: {
          animation?: string | null
          annotation_id?: string | null
          created_at?: string
          draw_type: string
          duration_ms?: number | null
          end_x?: number | null
          end_y?: number | null
          fill_color?: string | null
          font_family?: string | null
          font_size?: number | null
          height?: number | null
          id?: string
          opacity?: number | null
          path_data?: Json | null
          session_id: string
          start_x: number
          start_y: number
          stroke_color?: string | null
          stroke_width?: number | null
          text_content?: string | null
          timestamp_ms: number
          updated_at?: string
          user_id: string
          width?: number | null
        }
        Update: {
          animation?: string | null
          annotation_id?: string | null
          created_at?: string
          draw_type?: string
          duration_ms?: number | null
          end_x?: number | null
          end_y?: number | null
          fill_color?: string | null
          font_family?: string | null
          font_size?: number | null
          height?: number | null
          id?: string
          opacity?: number | null
          path_data?: Json | null
          session_id?: string
          start_x?: number
          start_y?: number
          stroke_color?: string | null
          stroke_width?: number | null
          text_content?: string | null
          timestamp_ms?: number
          updated_at?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "draw_annotations_annotation_id_fkey"
            columns: ["annotation_id"]
            isOneToOne: false
            referencedRelation: "annotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draw_annotations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "capture_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      dropbox_sync_status: {
        Row: {
          completed_at: string | null
          created_at: string
          dropbox_file_id: string | null
          dropbox_path: string | null
          error_message: string | null
          file_size_bytes: number | null
          id: string
          session_id: string
          started_at: string | null
          sync_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          dropbox_file_id?: string | null
          dropbox_path?: string | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          session_id: string
          started_at?: string | null
          sync_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          dropbox_file_id?: string | null
          dropbox_path?: string | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          session_id?: string
          started_at?: string | null
          sync_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dropbox_sync_status_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "capture_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      facecam_tracks: {
        Row: {
          border_radius: number | null
          created_at: string
          duration_ms: number
          file_size_bytes: number | null
          framerate: number | null
          height: number | null
          id: string
          is_visible: boolean | null
          offset_ms: number | null
          opacity: number | null
          position_x: number | null
          position_y: number | null
          scale: number | null
          session_id: string
          status: string | null
          storage_path: string | null
          storage_url: string
          updated_at: string
          user_id: string
          video_asset_id: string | null
          width: number | null
        }
        Insert: {
          border_radius?: number | null
          created_at?: string
          duration_ms?: number
          file_size_bytes?: number | null
          framerate?: number | null
          height?: number | null
          id?: string
          is_visible?: boolean | null
          offset_ms?: number | null
          opacity?: number | null
          position_x?: number | null
          position_y?: number | null
          scale?: number | null
          session_id: string
          status?: string | null
          storage_path?: string | null
          storage_url: string
          updated_at?: string
          user_id: string
          video_asset_id?: string | null
          width?: number | null
        }
        Update: {
          border_radius?: number | null
          created_at?: string
          duration_ms?: number
          file_size_bytes?: number | null
          framerate?: number | null
          height?: number | null
          id?: string
          is_visible?: boolean | null
          offset_ms?: number | null
          opacity?: number | null
          position_x?: number | null
          position_y?: number | null
          scale?: number | null
          session_id?: string
          status?: string | null
          storage_path?: string | null
          storage_url?: string
          updated_at?: string
          user_id?: string
          video_asset_id?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "facecam_tracks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "capture_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facecam_tracks_video_asset_id_fkey"
            columns: ["video_asset_id"]
            isOneToOne: false
            referencedRelation: "video_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      session_shares: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          permission: string | null
          session_id: string
          share_token: string | null
          shared_by: string
          shared_with: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          permission?: string | null
          session_id: string
          share_token?: string | null
          shared_by: string
          shared_with?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          permission?: string | null
          session_id?: string
          share_token?: string | null
          shared_by?: string
          shared_with?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_shares_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "capture_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      social_comments: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string
          id: string
          is_private: boolean | null
          is_resolved: boolean | null
          mentioned_users: string[] | null
          parent_id: string | null
          post_id: string | null
          reaction_counts: Json | null
          session_id: string
          timestamp_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string
          id?: string
          is_private?: boolean | null
          is_resolved?: boolean | null
          mentioned_users?: string[] | null
          parent_id?: string | null
          post_id?: string | null
          reaction_counts?: Json | null
          session_id: string
          timestamp_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string
          id?: string
          is_private?: boolean | null
          is_resolved?: boolean | null
          mentioned_users?: string[] | null
          parent_id?: string | null
          post_id?: string | null
          reaction_counts?: Json | null
          session_id?: string
          timestamp_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "social_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_comments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "capture_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_events: {
        Row: {
          color: string | null
          confidence: number | null
          created_at: string
          description: string | null
          duration_ms: number | null
          event_subtype: string | null
          event_type: string
          icon: string | null
          id: string
          importance: number | null
          is_bookmarked: boolean | null
          is_hidden: boolean | null
          metadata: Json | null
          session_id: string
          source: string | null
          timestamp_ms: number
          title: string | null
          user_id: string
          value: number | null
        }
        Insert: {
          color?: string | null
          confidence?: number | null
          created_at?: string
          description?: string | null
          duration_ms?: number | null
          event_subtype?: string | null
          event_type: string
          icon?: string | null
          id?: string
          importance?: number | null
          is_bookmarked?: boolean | null
          is_hidden?: boolean | null
          metadata?: Json | null
          session_id: string
          source?: string | null
          timestamp_ms: number
          title?: string | null
          user_id: string
          value?: number | null
        }
        Update: {
          color?: string | null
          confidence?: number | null
          created_at?: string
          description?: string | null
          duration_ms?: number | null
          event_subtype?: string | null
          event_type?: string
          icon?: string | null
          id?: string
          importance?: number | null
          is_bookmarked?: boolean | null
          is_hidden?: boolean | null
          metadata?: Json | null
          session_id?: string
          source?: string | null
          timestamp_ms?: number
          title?: string | null
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "capture_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          allow_ai_analysis: boolean | null
          auto_skip_dead_time: boolean | null
          camera_device_id: string | null
          camera_fps: string | null
          camera_mirror: boolean | null
          camera_resolution: string | null
          created_at: string
          default_game: string | null
          default_playback_speed: number | null
          default_session_visibility: string | null
          id: string
          notify_on_analysis_complete: boolean | null
          notify_on_comment: boolean | null
          notify_on_share: boolean | null
          record_facecam: boolean | null
          record_game_audio: boolean | null
          record_microphone: boolean | null
          show_ai_insights: boolean | null
          sidebar_collapsed: boolean | null
          theme: string | null
          timeline_zoom: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_ai_analysis?: boolean | null
          auto_skip_dead_time?: boolean | null
          camera_device_id?: string | null
          camera_fps?: string | null
          camera_mirror?: boolean | null
          camera_resolution?: string | null
          created_at?: string
          default_game?: string | null
          default_playback_speed?: number | null
          default_session_visibility?: string | null
          id?: string
          notify_on_analysis_complete?: boolean | null
          notify_on_comment?: boolean | null
          notify_on_share?: boolean | null
          record_facecam?: boolean | null
          record_game_audio?: boolean | null
          record_microphone?: boolean | null
          show_ai_insights?: boolean | null
          sidebar_collapsed?: boolean | null
          theme?: string | null
          timeline_zoom?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_ai_analysis?: boolean | null
          auto_skip_dead_time?: boolean | null
          camera_device_id?: string | null
          camera_fps?: string | null
          camera_mirror?: boolean | null
          camera_resolution?: string | null
          created_at?: string
          default_game?: string | null
          default_playback_speed?: number | null
          default_session_visibility?: string | null
          id?: string
          notify_on_analysis_complete?: boolean | null
          notify_on_comment?: boolean | null
          notify_on_share?: boolean | null
          record_facecam?: boolean | null
          record_game_audio?: boolean | null
          record_microphone?: boolean | null
          show_ai_insights?: boolean | null
          sidebar_collapsed?: boolean | null
          theme?: string | null
          timeline_zoom?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string
          device_info: string | null
          id: string
          ip_address: string | null
          is_current: boolean | null
          last_active_at: string
          location_text: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_active_at?: string
          location_text?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_active_at?: string
          location_text?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      video_assets: {
        Row: {
          asset_type: string | null
          bitrate: number | null
          codec: string | null
          created_at: string
          deleted_at: string | null
          duration_ms: number
          error_message: string | null
          file_size_bytes: number | null
          framerate: number | null
          height: number | null
          id: string
          mime_type: string | null
          processing_progress: number | null
          session_id: string
          status: string | null
          storage_path: string | null
          storage_url: string
          thumbnail_sprite_url: string | null
          thumbnail_url: string | null
          updated_at: string
          user_id: string
          width: number | null
        }
        Insert: {
          asset_type?: string | null
          bitrate?: number | null
          codec?: string | null
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number
          error_message?: string | null
          file_size_bytes?: number | null
          framerate?: number | null
          height?: number | null
          id?: string
          mime_type?: string | null
          processing_progress?: number | null
          session_id: string
          status?: string | null
          storage_path?: string | null
          storage_url: string
          thumbnail_sprite_url?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
          width?: number | null
        }
        Update: {
          asset_type?: string | null
          bitrate?: number | null
          codec?: string | null
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number
          error_message?: string | null
          file_size_bytes?: number | null
          framerate?: number | null
          height?: number | null
          id?: string
          mime_type?: string | null
          processing_progress?: number | null
          session_id?: string
          status?: string | null
          storage_path?: string | null
          storage_url?: string
          thumbnail_sprite_url?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_assets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "capture_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_notes: {
        Row: {
          annotation_id: string | null
          audio_url: string
          created_at: string
          duration_seconds: number
          id: string
          is_private: boolean | null
          language: string | null
          session_id: string
          timestamp_seconds: number
          transcription: string | null
          transcription_status: string | null
          user_id: string
          waveform_data: Json | null
        }
        Insert: {
          annotation_id?: string | null
          audio_url: string
          created_at?: string
          duration_seconds: number
          id?: string
          is_private?: boolean | null
          language?: string | null
          session_id: string
          timestamp_seconds: number
          transcription?: string | null
          transcription_status?: string | null
          user_id: string
          waveform_data?: Json | null
        }
        Update: {
          annotation_id?: string | null
          audio_url?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          is_private?: boolean | null
          language?: string | null
          session_id?: string
          timestamp_seconds?: number
          transcription?: string | null
          transcription_status?: string | null
          user_id?: string
          waveform_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_notes_annotation_id_fkey"
            columns: ["annotation_id"]
            isOneToOne: false
            referencedRelation: "annotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "capture_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
