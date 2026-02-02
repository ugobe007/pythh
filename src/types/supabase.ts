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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agent_traction_signals: {
        Row: {
          created_at: string | null
          detected_at: string
          evidence: Json | null
          id: string
          is_active: boolean | null
          magnitude: number
          signal_type: string
          source: string | null
          startup_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          detected_at?: string
          evidence?: Json | null
          id?: string
          is_active?: boolean | null
          magnitude?: number
          signal_type: string
          source?: string | null
          startup_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          detected_at?: string
          evidence?: Json | null
          id?: string
          is_active?: boolean | null
          magnitude?: number
          signal_type?: string
          source?: string | null
          startup_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          input_tokens: number | null
          model: string | null
          operation: string | null
          output_tokens: number | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          model?: string | null
          operation?: string | null
          output_tokens?: number | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          model?: string | null
          operation?: string | null
          output_tokens?: number | null
          status?: string | null
        }
        Relationships: []
      }
      algorithm_weight_history: {
        Row: {
          applied_at: string | null
          applied_by: string
          created_at: string | null
          id: string
          notes: string | null
          performance_after: Json | null
          performance_before: Json | null
          recommendation_id: string | null
          rollback_reason: string | null
          rolled_back: boolean | null
          rolled_back_at: string | null
          weight_updates: Json
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          performance_after?: Json | null
          performance_before?: Json | null
          recommendation_id?: string | null
          rollback_reason?: string | null
          rolled_back?: boolean | null
          rolled_back_at?: string | null
          weight_updates: Json
        }
        Update: {
          applied_at?: string | null
          applied_by?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          performance_after?: Json | null
          performance_before?: Json | null
          recommendation_id?: string | null
          rollback_reason?: string | null
          rolled_back?: boolean | null
          rolled_back_at?: string | null
          weight_updates?: Json
        }
        Relationships: [
          {
            foreignKeyName: "algorithm_weight_history_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "ml_recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      alignment_events: {
        Row: {
          created_at: string | null
          event_date: string
          event_description: string | null
          event_title: string
          event_type: string
          id: string
          impact: string | null
          importance: string | null
          investor_count: number | null
          investor_type: string | null
          new_value: string | null
          old_value: string | null
          signal_name: string | null
          startup_id: string
          startup_url: string | null
        }
        Insert: {
          created_at?: string | null
          event_date?: string
          event_description?: string | null
          event_title: string
          event_type: string
          id?: string
          impact?: string | null
          importance?: string | null
          investor_count?: number | null
          investor_type?: string | null
          new_value?: string | null
          old_value?: string | null
          signal_name?: string | null
          startup_id: string
          startup_url?: string | null
        }
        Update: {
          created_at?: string | null
          event_date?: string
          event_description?: string | null
          event_title?: string
          event_type?: string
          id?: string
          impact?: string | null
          importance?: string | null
          investor_count?: number | null
          investor_type?: string | null
          new_value?: string | null
          old_value?: string | null
          signal_name?: string | null
          startup_id?: string
          startup_url?: string | null
        }
        Relationships: []
      }
      alignment_stories: {
        Row: {
          alignment_state_after: string | null
          alignment_state_before: string | null
          alignment_trend: string | null
          anonymization_level: string | null
          archetype: string | null
          bookmark_count: number | null
          chapter_number: number | null
          created_at: string | null
          current_alignment_state: string | null
          entry_paths: string[] | null
          geography: string | null
          id: string
          industry: string
          investor_names: string[] | null
          investor_reactions: Json | null
          is_canonical: boolean | null
          is_continuation: boolean | null
          last_investor_reaction: string | null
          last_updated_at: string | null
          months_since_alignment: number | null
          parent_story_id: string | null
          result_text: string
          signal_timeline: Json | null
          signals_added: string[] | null
          signals_present: string[] | null
          source_startup_id: string | null
          stage: string
          startup_type_label: string
          tempo_class: string | null
          timing_context: string | null
          typical_investors: string[] | null
          updated_at: string | null
          view_count: number | null
          what_changed_text: string
        }
        Insert: {
          alignment_state_after?: string | null
          alignment_state_before?: string | null
          alignment_trend?: string | null
          anonymization_level?: string | null
          archetype?: string | null
          bookmark_count?: number | null
          chapter_number?: number | null
          created_at?: string | null
          current_alignment_state?: string | null
          entry_paths?: string[] | null
          geography?: string | null
          id?: string
          industry: string
          investor_names?: string[] | null
          investor_reactions?: Json | null
          is_canonical?: boolean | null
          is_continuation?: boolean | null
          last_investor_reaction?: string | null
          last_updated_at?: string | null
          months_since_alignment?: number | null
          parent_story_id?: string | null
          result_text: string
          signal_timeline?: Json | null
          signals_added?: string[] | null
          signals_present?: string[] | null
          source_startup_id?: string | null
          stage: string
          startup_type_label: string
          tempo_class?: string | null
          timing_context?: string | null
          typical_investors?: string[] | null
          updated_at?: string | null
          view_count?: number | null
          what_changed_text: string
        }
        Update: {
          alignment_state_after?: string | null
          alignment_state_before?: string | null
          alignment_trend?: string | null
          anonymization_level?: string | null
          archetype?: string | null
          bookmark_count?: number | null
          chapter_number?: number | null
          created_at?: string | null
          current_alignment_state?: string | null
          entry_paths?: string[] | null
          geography?: string | null
          id?: string
          industry?: string
          investor_names?: string[] | null
          investor_reactions?: Json | null
          is_canonical?: boolean | null
          is_continuation?: boolean | null
          last_investor_reaction?: string | null
          last_updated_at?: string | null
          months_since_alignment?: number | null
          parent_story_id?: string | null
          result_text?: string
          signal_timeline?: Json | null
          signals_added?: string[] | null
          signals_present?: string[] | null
          source_startup_id?: string | null
          stage?: string
          startup_type_label?: string
          tempo_class?: string | null
          timing_context?: string | null
          typical_investors?: string[] | null
          updated_at?: string | null
          view_count?: number | null
          what_changed_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "alignment_stories_parent_story_id_fkey"
            columns: ["parent_story_id"]
            isOneToOne: false
            referencedRelation: "alignment_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alignment_stories_source_startup_id_fkey"
            columns: ["source_startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "alignment_stories_source_startup_id_fkey"
            columns: ["source_startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "alignment_stories_source_startup_id_fkey"
            columns: ["source_startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "alignment_stories_source_startup_id_fkey"
            columns: ["source_startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alignment_stories_source_startup_id_fkey"
            columns: ["source_startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alignment_stories_source_startup_id_fkey"
            columns: ["source_startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alignment_stories_source_startup_id_fkey"
            columns: ["source_startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alignment_stories_source_startup_id_fkey"
            columns: ["source_startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alignment_stories_source_startup_id_fkey"
            columns: ["source_startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alignment_stories_source_startup_id_fkey"
            columns: ["source_startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alignment_stories_source_startup_id_fkey"
            columns: ["source_startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alignment_stories_source_startup_id_fkey"
            columns: ["source_startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alignment_stories_source_startup_id_fkey"
            columns: ["source_startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alignment_stories_source_startup_id_fkey"
            columns: ["source_startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "alignment_stories_source_startup_id_fkey"
            columns: ["source_startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alignment_stories_source_startup_id_fkey"
            columns: ["source_startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alignment_stories_source_startup_id_fkey"
            columns: ["source_startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      archetype_transitions: {
        Row: {
          created_at: string | null
          from_archetype: string | null
          from_sub_archetype: string | null
          id: number
          signal_strength_after: number | null
          signal_strength_before: number | null
          startup_id: string
          to_archetype: string | null
          to_sub_archetype: string | null
          transition_date: string
        }
        Insert: {
          created_at?: string | null
          from_archetype?: string | null
          from_sub_archetype?: string | null
          id?: number
          signal_strength_after?: number | null
          signal_strength_before?: number | null
          startup_id: string
          to_archetype?: string | null
          to_sub_archetype?: string | null
          transition_date?: string
        }
        Update: {
          created_at?: string | null
          from_archetype?: string | null
          from_sub_archetype?: string | null
          id?: number
          signal_strength_after?: number | null
          signal_strength_before?: number | null
          startup_id?: string
          to_archetype?: string | null
          to_sub_archetype?: string | null
          transition_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "archetype_transitions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "archetype_transitions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "archetype_transitions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "archetype_transitions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archetype_transitions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archetype_transitions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archetype_transitions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archetype_transitions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archetype_transitions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archetype_transitions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archetype_transitions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archetype_transitions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archetype_transitions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archetype_transitions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "archetype_transitions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archetype_transitions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archetype_transitions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      backtest_cohort_members: {
        Row: {
          cohort_name: string
          label: string
          startup_id: string
        }
        Insert: {
          cohort_name: string
          label?: string
          startup_id: string
        }
        Update: {
          cohort_name?: string
          label?: string
          startup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backtest_cohort_members_cohort_name_fkey"
            columns: ["cohort_name"]
            isOneToOne: false
            referencedRelation: "backtest_cohorts"
            referencedColumns: ["cohort_name"]
          },
        ]
      }
      backtest_cohorts: {
        Row: {
          cohort_name: string
          created_at: string
          description: string | null
        }
        Insert: {
          cohort_name: string
          created_at?: string
          description?: string | null
        }
        Update: {
          cohort_name?: string
          created_at?: string
          description?: string | null
        }
        Relationships: []
      }
      data_deletion_audit: {
        Row: {
          deleted_at: string | null
          deleted_by: string | null
          id: string
          ip_address: unknown
          operation: string
          query_text: string | null
          rows_deleted: number | null
          table_name: string
          user_agent: string | null
        }
        Insert: {
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          ip_address?: unknown
          operation: string
          query_text?: string | null
          rows_deleted?: number | null
          table_name: string
          user_agent?: string | null
        }
        Update: {
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          ip_address?: unknown
          operation?: string
          query_text?: string | null
          rows_deleted?: number | null
          table_name?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      data_integrity_snapshots: {
        Row: {
          approved_startups: number
          avg_god_score: number | null
          avg_match_score: number | null
          created_at: string | null
          deviation_notes: string | null
          has_deviation: boolean | null
          high_quality_matches: number
          id: string
          investors_delta: number | null
          investors_with_embeddings: number | null
          matches_delta: number | null
          pending_startups: number
          startups_delta: number | null
          startups_with_embeddings: number | null
          total_investors: number
          total_matches: number
          total_startups: number
        }
        Insert: {
          approved_startups: number
          avg_god_score?: number | null
          avg_match_score?: number | null
          created_at?: string | null
          deviation_notes?: string | null
          has_deviation?: boolean | null
          high_quality_matches: number
          id?: string
          investors_delta?: number | null
          investors_with_embeddings?: number | null
          matches_delta?: number | null
          pending_startups: number
          startups_delta?: number | null
          startups_with_embeddings?: number | null
          total_investors: number
          total_matches: number
          total_startups: number
        }
        Update: {
          approved_startups?: number
          avg_god_score?: number | null
          avg_match_score?: number | null
          created_at?: string | null
          deviation_notes?: string | null
          has_deviation?: boolean | null
          high_quality_matches?: number
          id?: string
          investors_delta?: number | null
          investors_with_embeddings?: number | null
          matches_delta?: number | null
          pending_startups?: number
          startups_delta?: number | null
          startups_with_embeddings?: number | null
          total_investors?: number
          total_matches?: number
          total_startups?: number
        }
        Relationships: []
      }
      discovered_startups: {
        Row: {
          approved_at: string | null
          article_date: string | null
          article_title: string | null
          article_url: string | null
          created_at: string | null
          credential_signals: string[] | null
          customer_count: number | null
          description: string | null
          discovered_at: string | null
          discovered_from_article_id: string | null
          execution_signals: string[] | null
          founders: string[] | null
          funding_amount: string | null
          funding_stage: string | null
          grit_signals: string[] | null
          growth_rate: string | null
          has_customers: boolean | null
          has_demo: boolean | null
          has_revenue: boolean | null
          has_technical_cofounder: boolean | null
          id: string
          imported_at: string | null
          imported_to_startups: boolean | null
          investors_mentioned: string[] | null
          is_launched: boolean | null
          lead_investor: string | null
          market_size: string | null
          name: string
          problem: string | null
          problem_keywords: string[] | null
          problem_severity: number | null
          rss_source: string | null
          sectors: string[] | null
          solution: string | null
          startup_id: string | null
          team_companies: string[] | null
          team_signals: string[] | null
          updated_at: string | null
          value_proposition: string | null
          website: string | null
          website_status: string | null
          website_verified: boolean | null
        }
        Insert: {
          approved_at?: string | null
          article_date?: string | null
          article_title?: string | null
          article_url?: string | null
          created_at?: string | null
          credential_signals?: string[] | null
          customer_count?: number | null
          description?: string | null
          discovered_at?: string | null
          discovered_from_article_id?: string | null
          execution_signals?: string[] | null
          founders?: string[] | null
          funding_amount?: string | null
          funding_stage?: string | null
          grit_signals?: string[] | null
          growth_rate?: string | null
          has_customers?: boolean | null
          has_demo?: boolean | null
          has_revenue?: boolean | null
          has_technical_cofounder?: boolean | null
          id?: string
          imported_at?: string | null
          imported_to_startups?: boolean | null
          investors_mentioned?: string[] | null
          is_launched?: boolean | null
          lead_investor?: string | null
          market_size?: string | null
          name: string
          problem?: string | null
          problem_keywords?: string[] | null
          problem_severity?: number | null
          rss_source?: string | null
          sectors?: string[] | null
          solution?: string | null
          startup_id?: string | null
          team_companies?: string[] | null
          team_signals?: string[] | null
          updated_at?: string | null
          value_proposition?: string | null
          website?: string | null
          website_status?: string | null
          website_verified?: boolean | null
        }
        Update: {
          approved_at?: string | null
          article_date?: string | null
          article_title?: string | null
          article_url?: string | null
          created_at?: string | null
          credential_signals?: string[] | null
          customer_count?: number | null
          description?: string | null
          discovered_at?: string | null
          discovered_from_article_id?: string | null
          execution_signals?: string[] | null
          founders?: string[] | null
          funding_amount?: string | null
          funding_stage?: string | null
          grit_signals?: string[] | null
          growth_rate?: string | null
          has_customers?: boolean | null
          has_demo?: boolean | null
          has_revenue?: boolean | null
          has_technical_cofounder?: boolean | null
          id?: string
          imported_at?: string | null
          imported_to_startups?: boolean | null
          investors_mentioned?: string[] | null
          is_launched?: boolean | null
          lead_investor?: string | null
          market_size?: string | null
          name?: string
          problem?: string | null
          problem_keywords?: string[] | null
          problem_severity?: number | null
          rss_source?: string | null
          sectors?: string[] | null
          solution?: string | null
          startup_id?: string | null
          team_companies?: string[] | null
          team_signals?: string[] | null
          updated_at?: string | null
          value_proposition?: string | null
          website?: string | null
          website_status?: string | null
          website_verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "discovered_startups_discovered_from_article_id_fkey"
            columns: ["discovered_from_article_id"]
            isOneToOne: false
            referencedRelation: "rss_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      ecosystem_signals: {
        Row: {
          created_at: string | null
          focus_areas: string[] | null
          id: string
          name: string
          notes: string | null
          signal_strength: number | null
          signal_type: string
          tier: number | null
        }
        Insert: {
          created_at?: string | null
          focus_areas?: string[] | null
          id?: string
          name: string
          notes?: string | null
          signal_strength?: number | null
          signal_type: string
          tier?: number | null
        }
        Update: {
          created_at?: string | null
          focus_areas?: string[] | null
          id?: string
          name?: string
          notes?: string | null
          signal_strength?: number | null
          signal_type?: string
          tier?: number | null
        }
        Relationships: []
      }
      email_digests: {
        Row: {
          created_at: string
          digest_date: string
          email_error: string | null
          email_sent_at: string | null
          email_status: string
          id: string
          notification_ids: string[]
          user_id: string | null
          window_end: string
          window_start: string
        }
        Insert: {
          created_at?: string
          digest_date: string
          email_error?: string | null
          email_sent_at?: string | null
          email_status?: string
          id?: string
          notification_ids?: string[]
          user_id?: string | null
          window_end: string
          window_start: string
        }
        Update: {
          created_at?: string
          digest_date?: string
          email_error?: string | null
          email_sent_at?: string | null
          email_status?: string
          id?: string
          notification_ids?: string[]
          user_id?: string | null
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          active: boolean | null
          available_variables: Json | null
          avg_click_rate: number | null
          avg_conversion_rate: number | null
          avg_open_rate: number | null
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          html_template: string
          id: string
          is_default: boolean | null
          name: string
          slug: string
          subject_template: string
          text_template: string | null
          times_used: number | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          available_variables?: Json | null
          avg_click_rate?: number | null
          avg_conversion_rate?: number | null
          avg_open_rate?: number | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          html_template: string
          id?: string
          is_default?: boolean | null
          name: string
          slug: string
          subject_template: string
          text_template?: string | null
          times_used?: number | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          available_variables?: Json | null
          avg_click_rate?: number | null
          avg_conversion_rate?: number | null
          avg_open_rate?: number | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          html_template?: string
          id?: string
          is_default?: boolean | null
          name?: string
          slug?: string
          subject_template?: string
          text_template?: string | null
          times_used?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_unsubscribes: {
        Row: {
          email: string
          id: string
          reason: string | null
          unsubscribed_at: string | null
          user_id: string | null
        }
        Insert: {
          email: string
          id?: string
          reason?: string | null
          unsubscribed_at?: string | null
          user_id?: string | null
        }
        Update: {
          email?: string
          id?: string
          reason?: string | null
          unsubscribed_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      entity_ontologies: {
        Row: {
          confidence: number
          created_at: string
          entity_name: string
          entity_type: string
          id: string
          metadata: Json | null
          source: string
          updated_at: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          entity_name: string
          entity_type: string
          id?: string
          metadata?: Json | null
          source: string
          updated_at?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          entity_name?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      entry_path_patterns: {
        Row: {
          best_for_sectors: string[] | null
          best_for_stages: string[] | null
          created_at: string | null
          id: string
          investor_id: string | null
          path_description: string | null
          path_type: string
          rank_order: number | null
          sample_size: number | null
          success_rate: number | null
          typical_time_to_meeting_days: number | null
        }
        Insert: {
          best_for_sectors?: string[] | null
          best_for_stages?: string[] | null
          created_at?: string | null
          id?: string
          investor_id?: string | null
          path_description?: string | null
          path_type: string
          rank_order?: number | null
          sample_size?: number | null
          success_rate?: number | null
          typical_time_to_meeting_days?: number | null
        }
        Update: {
          best_for_sectors?: string[] | null
          best_for_stages?: string[] | null
          created_at?: string | null
          id?: string
          investor_id?: string | null
          path_description?: string | null
          path_type?: string
          rank_order?: number | null
          sample_size?: number | null
          success_rate?: number | null
          typical_time_to_meeting_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entry_path_patterns_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "entry_path_patterns_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "entry_path_patterns_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_path_patterns_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_pricing_tiers: {
        Row: {
          base_price: number
          confidence_level: string | null
          created_at: string | null
          data_source: string
          effective_date: string | null
          equipment_type: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          manufacturer: string | null
          markup_percentage: number | null
          model: string | null
          notes: string | null
          price_unit: string
          size_max: number | null
          size_min: number | null
          size_unit: string | null
          source_date: string | null
          source_url: string | null
          specifications: Json | null
          tier_name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          base_price: number
          confidence_level?: string | null
          created_at?: string | null
          data_source?: string
          effective_date?: string | null
          equipment_type: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          manufacturer?: string | null
          markup_percentage?: number | null
          model?: string | null
          notes?: string | null
          price_unit: string
          size_max?: number | null
          size_min?: number | null
          size_unit?: string | null
          source_date?: string | null
          source_url?: string | null
          specifications?: Json | null
          tier_name: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          base_price?: number
          confidence_level?: string | null
          created_at?: string | null
          data_source?: string
          effective_date?: string | null
          equipment_type?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          manufacturer?: string | null
          markup_percentage?: number | null
          model?: string | null
          notes?: string | null
          price_unit?: string
          size_max?: number | null
          size_min?: number | null
          size_unit?: string | null
          source_date?: string | null
          source_url?: string | null
          specifications?: Json | null
          tier_name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      event_weights: {
        Row: {
          event_type: string
          weight: number
        }
        Insert: {
          event_type: string
          weight?: number
        }
        Update: {
          event_type?: string
          weight?: number
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_name: string
          id: string
          page: string | null
          plan: string | null
          properties: Json
          referrer: string | null
          session_id: string | null
          source: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_name: string
          id?: string
          page?: string | null
          plan?: string | null
          properties?: Json
          referrer?: string | null
          session_id?: string | null
          source?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_name?: string
          id?: string
          page?: string | null
          plan?: string | null
          properties?: Json
          referrer?: string | null
          session_id?: string | null
          source?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      faith_alignment_matches: {
        Row: {
          confidence: number | null
          created_at: string | null
          faith_alignment_score: number
          id: string
          investor_id: string | null
          match_source: string | null
          matched_at: string | null
          rationale: Json
          signal_ids: string[] | null
          startup_id: string | null
          updated_at: string | null
          validation_ids: string[] | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          faith_alignment_score?: number
          id?: string
          investor_id?: string | null
          match_source?: string | null
          matched_at?: string | null
          rationale?: Json
          signal_ids?: string[] | null
          startup_id?: string | null
          updated_at?: string | null
          validation_ids?: string[] | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          faith_alignment_score?: number
          id?: string
          investor_id?: string | null
          match_source?: string | null
          matched_at?: string | null
          rationale?: Json
          signal_ids?: string[] | null
          startup_id?: string | null
          updated_at?: string | null
          validation_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "faith_alignment_matches_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "faith_alignment_matches_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "faith_alignment_matches_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faith_alignment_matches_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faith_alignment_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "faith_alignment_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "faith_alignment_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "faith_alignment_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faith_alignment_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faith_alignment_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faith_alignment_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faith_alignment_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faith_alignment_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faith_alignment_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faith_alignment_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faith_alignment_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faith_alignment_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faith_alignment_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "faith_alignment_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faith_alignment_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faith_alignment_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_alignment_snapshots: {
        Row: {
          active_investors: number | null
          alignment_score: number | null
          alignment_state: string
          created_at: string | null
          id: string
          investor_count: number | null
          market_score: number | null
          monitoring_investors: number | null
          new_investors_this_week: number | null
          product_score: number | null
          signal_count: number | null
          signals_present: string[] | null
          snapshot_date: string
          startup_id: string
          startup_url: string | null
          team_score: number | null
          traction_score: number | null
        }
        Insert: {
          active_investors?: number | null
          alignment_score?: number | null
          alignment_state: string
          created_at?: string | null
          id?: string
          investor_count?: number | null
          market_score?: number | null
          monitoring_investors?: number | null
          new_investors_this_week?: number | null
          product_score?: number | null
          signal_count?: number | null
          signals_present?: string[] | null
          snapshot_date?: string
          startup_id: string
          startup_url?: string | null
          team_score?: number | null
          traction_score?: number | null
        }
        Update: {
          active_investors?: number | null
          alignment_score?: number | null
          alignment_state?: string
          created_at?: string | null
          id?: string
          investor_count?: number | null
          market_score?: number | null
          monitoring_investors?: number | null
          new_investors_this_week?: number | null
          product_score?: number | null
          signal_count?: number | null
          signals_present?: string[] | null
          snapshot_date?: string
          startup_id?: string
          startup_url?: string | null
          team_score?: number | null
          traction_score?: number | null
        }
        Relationships: []
      }
      founder_hire_matches: {
        Row: {
          alignment_type: string[] | null
          candidate_courage: string | null
          candidate_experience_level: string | null
          candidate_intelligence: string | null
          candidate_skill_type: string | null
          contacted_at: string | null
          created_at: string | null
          founder_courage: string | null
          founder_intelligence: string | null
          founder_speed_score: number | null
          founder_technical: boolean | null
          hired_at: string | null
          id: string
          interviewed_at: string | null
          match_reasons: string[] | null
          match_score: number
          rejected_at: string | null
          rejection_reason: string | null
          startup_id: string
          status: string | null
          talent_id: string
          updated_at: string | null
        }
        Insert: {
          alignment_type?: string[] | null
          candidate_courage?: string | null
          candidate_experience_level?: string | null
          candidate_intelligence?: string | null
          candidate_skill_type?: string | null
          contacted_at?: string | null
          created_at?: string | null
          founder_courage?: string | null
          founder_intelligence?: string | null
          founder_speed_score?: number | null
          founder_technical?: boolean | null
          hired_at?: string | null
          id?: string
          interviewed_at?: string | null
          match_reasons?: string[] | null
          match_score: number
          rejected_at?: string | null
          rejection_reason?: string | null
          startup_id: string
          status?: string | null
          talent_id: string
          updated_at?: string | null
        }
        Update: {
          alignment_type?: string[] | null
          candidate_courage?: string | null
          candidate_experience_level?: string | null
          candidate_intelligence?: string | null
          candidate_skill_type?: string | null
          contacted_at?: string | null
          created_at?: string | null
          founder_courage?: string | null
          founder_intelligence?: string | null
          founder_speed_score?: number | null
          founder_technical?: boolean | null
          hired_at?: string | null
          id?: string
          interviewed_at?: string | null
          match_reasons?: string[] | null
          match_score?: number
          rejected_at?: string | null
          rejection_reason?: string | null
          startup_id?: string
          status?: string | null
          talent_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "talent_pool"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_notification_prefs: {
        Row: {
          alignment_changes: boolean | null
          created_at: string | null
          email: string | null
          id: string
          investor_alerts: boolean | null
          is_active: boolean | null
          last_sent_at: string | null
          signal_alerts: boolean | null
          startup_url: string | null
          updated_at: string | null
          user_id: string | null
          weekly_digest: boolean | null
        }
        Insert: {
          alignment_changes?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          investor_alerts?: boolean | null
          is_active?: boolean | null
          last_sent_at?: string | null
          signal_alerts?: boolean | null
          startup_url?: string | null
          updated_at?: string | null
          user_id?: string | null
          weekly_digest?: boolean | null
        }
        Update: {
          alignment_changes?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          investor_alerts?: boolean | null
          is_active?: boolean | null
          last_sent_at?: string | null
          signal_alerts?: boolean | null
          startup_url?: string | null
          updated_at?: string | null
          user_id?: string | null
          weekly_digest?: boolean | null
        }
        Relationships: []
      }
      founder_readiness_snapshots: {
        Row: {
          created_at: string | null
          founder_session_id: string | null
          id: string
          investor_id: string
          matched_signals: string[] | null
          missing_signals: string[] | null
          readiness_score: number | null
          recommended_next_steps: string[] | null
          signal_coverage_ratio: number | null
          snapshot_date: string | null
          startup_id: string | null
          startup_url: string | null
          timing_reason: string | null
          timing_state: string | null
        }
        Insert: {
          created_at?: string | null
          founder_session_id?: string | null
          id?: string
          investor_id: string
          matched_signals?: string[] | null
          missing_signals?: string[] | null
          readiness_score?: number | null
          recommended_next_steps?: string[] | null
          signal_coverage_ratio?: number | null
          snapshot_date?: string | null
          startup_id?: string | null
          startup_url?: string | null
          timing_reason?: string | null
          timing_state?: string | null
        }
        Update: {
          created_at?: string | null
          founder_session_id?: string | null
          id?: string
          investor_id?: string
          matched_signals?: string[] | null
          missing_signals?: string[] | null
          readiness_score?: number | null
          recommended_next_steps?: string[] | null
          signal_coverage_ratio?: number | null
          snapshot_date?: string | null
          startup_id?: string | null
          startup_url?: string | null
          timing_reason?: string | null
          timing_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "founder_readiness_snapshots_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "founder_readiness_snapshots_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "founder_readiness_snapshots_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_readiness_snapshots_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_readiness_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "founder_readiness_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "founder_readiness_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "founder_readiness_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_readiness_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_readiness_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_readiness_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_readiness_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_readiness_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_readiness_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_readiness_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_readiness_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_readiness_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_readiness_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "founder_readiness_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_readiness_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_readiness_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_benchmarks: {
        Row: {
          bottom_25_percent: number | null
          description: string | null
          id: string
          median: number | null
          metric_category: string
          metric_name: string
          source: string | null
          stage: string
          top_10_percent: number | null
          top_25_percent: number | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          bottom_25_percent?: number | null
          description?: string | null
          id?: string
          median?: number | null
          metric_category: string
          metric_name: string
          source?: string | null
          stage: string
          top_10_percent?: number | null
          top_25_percent?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          bottom_25_percent?: number | null
          description?: string | null
          id?: string
          median?: number | null
          metric_category?: string
          metric_name?: string
          source?: string | null
          stage?: string
          top_10_percent?: number | null
          top_25_percent?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      funding_forecasts: {
        Row: {
          acceleration_factors: string[] | null
          confidence_level: string | null
          created_at: string | null
          funding_probability: number
          id: string
          investor_interest_score: number
          investor_signals: Json | null
          last_calculated_at: string | null
          market_signals: Json | null
          predicted_amount_max: number | null
          predicted_amount_min: number | null
          predicted_round: string | null
          predicted_timeline_months: number | null
          risk_factors: string[] | null
          startup_id: string
          team_signals: Json | null
          top_investor_matches: string[] | null
          traction_signals: Json | null
          updated_at: string | null
          urgency_score: number
        }
        Insert: {
          acceleration_factors?: string[] | null
          confidence_level?: string | null
          created_at?: string | null
          funding_probability?: number
          id?: string
          investor_interest_score?: number
          investor_signals?: Json | null
          last_calculated_at?: string | null
          market_signals?: Json | null
          predicted_amount_max?: number | null
          predicted_amount_min?: number | null
          predicted_round?: string | null
          predicted_timeline_months?: number | null
          risk_factors?: string[] | null
          startup_id: string
          team_signals?: Json | null
          top_investor_matches?: string[] | null
          traction_signals?: Json | null
          updated_at?: string | null
          urgency_score?: number
        }
        Update: {
          acceleration_factors?: string[] | null
          confidence_level?: string | null
          created_at?: string | null
          funding_probability?: number
          id?: string
          investor_interest_score?: number
          investor_signals?: Json | null
          last_calculated_at?: string | null
          market_signals?: Json | null
          predicted_amount_max?: number | null
          predicted_amount_min?: number | null
          predicted_round?: string | null
          predicted_timeline_months?: number | null
          risk_factors?: string[] | null
          startup_id?: string
          team_signals?: Json | null
          top_investor_matches?: string[] | null
          traction_signals?: Json | null
          updated_at?: string | null
          urgency_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "funding_forecasts_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "funding_forecasts_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "funding_forecasts_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "funding_forecasts_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_forecasts_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_forecasts_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_forecasts_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_forecasts_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_forecasts_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_forecasts_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_forecasts_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_forecasts_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_forecasts_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_forecasts_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "funding_forecasts_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_forecasts_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_forecasts_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_outcomes: {
        Row: {
          created_at: string | null
          funding_amount: number | null
          funding_round: string | null
          god_score_at_time: number | null
          id: string
          outcome_date: string | null
          outcome_type: string | null
          startup_id: string | null
          startup_name: string | null
        }
        Insert: {
          created_at?: string | null
          funding_amount?: number | null
          funding_round?: string | null
          god_score_at_time?: number | null
          id?: string
          outcome_date?: string | null
          outcome_type?: string | null
          startup_id?: string | null
          startup_name?: string | null
        }
        Update: {
          created_at?: string | null
          funding_amount?: number | null
          funding_round?: string | null
          god_score_at_time?: number | null
          id?: string
          outcome_date?: string | null
          outcome_type?: string | null
          startup_id?: string | null
          startup_name?: string | null
        }
        Relationships: []
      }
      funding_rounds: {
        Row: {
          amount: number | null
          announced: boolean | null
          created_at: string | null
          date: string
          id: string
          investors: string[] | null
          lead_investor: string | null
          round_type: string
          source: string | null
          source_url: string | null
          startup_id: string | null
          updated_at: string | null
          valuation: number | null
        }
        Insert: {
          amount?: number | null
          announced?: boolean | null
          created_at?: string | null
          date: string
          id?: string
          investors?: string[] | null
          lead_investor?: string | null
          round_type: string
          source?: string | null
          source_url?: string | null
          startup_id?: string | null
          updated_at?: string | null
          valuation?: number | null
        }
        Update: {
          amount?: number | null
          announced?: boolean | null
          created_at?: string | null
          date?: string
          id?: string
          investors?: string[] | null
          lead_investor?: string | null
          round_type?: string
          source?: string | null
          source_url?: string | null
          startup_id?: string | null
          updated_at?: string | null
          valuation?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "funding_rounds_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "funding_rounds_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "funding_rounds_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "funding_rounds_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_rounds_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_rounds_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_rounds_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_rounds_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_rounds_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_rounds_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_rounds_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_rounds_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_rounds_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_rounds_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "funding_rounds_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_rounds_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_rounds_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_strategies: {
        Row: {
          common_mistakes: Json | null
          created_at: string | null
          description: string
          examples: string[] | null
          id: string
          source: string | null
          stage: string[] | null
          strategy_type: string
          tactics: Json
          title: string
        }
        Insert: {
          common_mistakes?: Json | null
          created_at?: string | null
          description: string
          examples?: string[] | null
          id?: string
          source?: string | null
          stage?: string[] | null
          strategy_type: string
          tactics: Json
          title: string
        }
        Update: {
          common_mistakes?: Json | null
          created_at?: string | null
          description?: string
          examples?: string[] | null
          id?: string
          source?: string | null
          stage?: string[] | null
          strategy_type?: string
          tactics?: Json
          title?: string
        }
        Relationships: []
      }
      goldilocks_threshold_profiles: {
        Row: {
          created_at: string
          description: string | null
          min_avg_irrev_7d: number
          min_domains_7d: number
          min_pvi_7d: number
          min_pvi_accel_ratio: number
          profile_key: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          min_avg_irrev_7d: number
          min_domains_7d: number
          min_pvi_7d: number
          min_pvi_accel_ratio: number
          profile_key: string
        }
        Update: {
          created_at?: string
          description?: string | null
          min_avg_irrev_7d?: number
          min_domains_7d?: number
          min_pvi_7d?: number
          min_pvi_accel_ratio?: number
          profile_key?: string
        }
        Relationships: []
      }
      grit_signals: {
        Row: {
          anti_patterns: string[] | null
          created_at: string | null
          description: string | null
          examples: string[] | null
          how_to_detect: string | null
          id: string
          keywords: string[] | null
          signal_category: string
          signal_name: string
          weight: number | null
        }
        Insert: {
          anti_patterns?: string[] | null
          created_at?: string | null
          description?: string | null
          examples?: string[] | null
          how_to_detect?: string | null
          id?: string
          keywords?: string[] | null
          signal_category: string
          signal_name: string
          weight?: number | null
        }
        Update: {
          anti_patterns?: string[] | null
          created_at?: string | null
          description?: string | null
          examples?: string[] | null
          how_to_detect?: string | null
          id?: string
          keywords?: string[] | null
          signal_category?: string
          signal_name?: string
          weight?: number | null
        }
        Relationships: []
      }
      hero_matches: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          investor_id: string | null
          is_active: boolean | null
          match_score: number
          startup_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          id?: string
          investor_id?: string | null
          is_active?: boolean | null
          match_score: number
          startup_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          investor_id?: string | null
          is_active?: boolean | null
          match_score?: number
          startup_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hero_matches_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "hero_matches_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "hero_matches_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_matches_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "hero_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "hero_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "hero_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "hero_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      historical_replay_results: {
        Row: {
          alignment: string | null
          checkpoint_at: string
          created_at: string
          fresh_signals: number | null
          id: string
          phase: string | null
          result: Json
          signal: string | null
          stability_score: number | null
          structural_score: number | null
          tempo_class: string
          test_case_id: string
          total_signals: number | null
          velocity_score: number | null
        }
        Insert: {
          alignment?: string | null
          checkpoint_at: string
          created_at?: string
          fresh_signals?: number | null
          id?: string
          phase?: string | null
          result: Json
          signal?: string | null
          stability_score?: number | null
          structural_score?: number | null
          tempo_class: string
          test_case_id: string
          total_signals?: number | null
          velocity_score?: number | null
        }
        Update: {
          alignment?: string | null
          checkpoint_at?: string
          created_at?: string
          fresh_signals?: number | null
          id?: string
          phase?: string | null
          result?: Json
          signal?: string | null
          stability_score?: number | null
          structural_score?: number | null
          tempo_class?: string
          test_case_id?: string
          total_signals?: number | null
          velocity_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "historical_replay_results_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "historical_test_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      historical_test_cases: {
        Row: {
          created_at: string
          expected_archetype: string | null
          expected_pattern: string | null
          id: string
          name: string
          notes: string | null
          slug: string
          source_urls: string[] | null
          tempo_class: string
        }
        Insert: {
          created_at?: string
          expected_archetype?: string | null
          expected_pattern?: string | null
          id?: string
          name: string
          notes?: string | null
          slug: string
          source_urls?: string[] | null
          tempo_class: string
        }
        Update: {
          created_at?: string
          expected_archetype?: string | null
          expected_pattern?: string | null
          id?: string
          name?: string
          notes?: string | null
          slug?: string
          source_urls?: string[] | null
          tempo_class?: string
        }
        Relationships: []
      }
      historical_test_events: {
        Row: {
          created_at: string
          id: string
          meta: Json
          occurred_at: string
          sentiment: number
          severity: number
          signal_type: string
          test_case_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          meta?: Json
          occurred_at: string
          sentiment?: number
          severity?: number
          signal_type: string
          test_case_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          meta?: Json
          occurred_at?: string
          sentiment?: number
          severity?: number
          signal_type?: string
          test_case_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "historical_test_events_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "historical_test_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      intro_requests: {
        Row: {
          created_at: string | null
          founder_email: string
          founder_name: string
          id: string
          investor_id: string
          match_score: number | null
          message: string | null
          startup_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          founder_email: string
          founder_name: string
          id?: string
          investor_id: string
          match_score?: number | null
          message?: string | null
          startup_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          founder_email?: string
          founder_name?: string
          id?: string
          investor_id?: string
          match_score?: number | null
          message?: string | null
          startup_id?: string
          status?: string | null
        }
        Relationships: []
      }
      investment_benchmarks: {
        Row: {
          ai_multiplier: number | null
          id: string
          industry: string
          last_updated: string | null
          median_raise_max: number | null
          median_raise_min: number | null
          source: string | null
          stage: string
          valuation_multiple_high: number | null
          valuation_multiple_low: number | null
        }
        Insert: {
          ai_multiplier?: number | null
          id?: string
          industry: string
          last_updated?: string | null
          median_raise_max?: number | null
          median_raise_min?: number | null
          source?: string | null
          stage: string
          valuation_multiple_high?: number | null
          valuation_multiple_low?: number | null
        }
        Update: {
          ai_multiplier?: number | null
          id?: string
          industry?: string
          last_updated?: string | null
          median_raise_max?: number | null
          median_raise_min?: number | null
          source?: string | null
          stage?: string
          valuation_multiple_high?: number | null
          valuation_multiple_low?: number | null
        }
        Relationships: []
      }
      investor_activity: {
        Row: {
          activity_type: string
          amount: string | null
          created_at: string | null
          date: string | null
          description: string | null
          id: string
          investor_id: string
          round_type: string | null
          source_url: string | null
          startup_id: string | null
          title: string
        }
        Insert: {
          activity_type: string
          amount?: string | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          id?: string
          investor_id: string
          round_type?: string | null
          source_url?: string | null
          startup_id?: string | null
          title: string
        }
        Update: {
          activity_type?: string
          amount?: string | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          id?: string
          investor_id?: string
          round_type?: string | null
          source_url?: string | null
          startup_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_activity_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_activity_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_activity_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_activity_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_activity_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "investor_activity_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "investor_activity_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "investor_activity_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_activity_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_activity_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_activity_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_activity_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_activity_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_activity_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_activity_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_activity_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_activity_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_activity_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "investor_activity_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_activity_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_activity_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_advice: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          id: string
          investor_id: string
          is_featured: boolean | null
          partner_id: string | null
          published_date: string | null
          source_type: string | null
          source_url: string | null
          tags: Json | null
          title: string
          updated_at: string | null
          views_count: number | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          id?: string
          investor_id: string
          is_featured?: boolean | null
          partner_id?: string | null
          published_date?: string | null
          source_type?: string | null
          source_url?: string | null
          tags?: Json | null
          title: string
          updated_at?: string | null
          views_count?: number | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          id?: string
          investor_id?: string
          is_featured?: boolean | null
          partner_id?: string | null
          published_date?: string | null
          source_type?: string | null
          source_url?: string | null
          tags?: Json | null
          title?: string
          updated_at?: string | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_advice_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_advice_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_advice_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_advice_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_advice_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "investor_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_behavior_summary: {
        Row: {
          investor_id: string
          last_viewed_at: string | null
          portfolio_page_visits: number | null
          recent_views: number | null
          similar_startups_viewed: number | null
          startup_id: string
          updated_at: string | null
        }
        Insert: {
          investor_id: string
          last_viewed_at?: string | null
          portfolio_page_visits?: number | null
          recent_views?: number | null
          similar_startups_viewed?: number | null
          startup_id: string
          updated_at?: string | null
        }
        Update: {
          investor_id?: string
          last_viewed_at?: string | null
          portfolio_page_visits?: number | null
          recent_views?: number | null
          similar_startups_viewed?: number | null
          startup_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_behavior_summary_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_behavior_summary_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_behavior_summary_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_behavior_summary_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_behavior_summary_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "investor_behavior_summary_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "investor_behavior_summary_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "investor_behavior_summary_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_behavior_summary_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_behavior_summary_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_behavior_summary_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_behavior_summary_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_behavior_summary_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_behavior_summary_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_behavior_summary_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_behavior_summary_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_behavior_summary_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_behavior_summary_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "investor_behavior_summary_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_behavior_summary_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_behavior_summary_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_connections: {
        Row: {
          co_investments_count: number | null
          connected_investor_id: string | null
          connection_strength: number | null
          connection_type: string
          created_at: string | null
          id: string
          investor_id: string | null
          last_co_investment_date: string | null
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          co_investments_count?: number | null
          connected_investor_id?: string | null
          connection_strength?: number | null
          connection_type: string
          created_at?: string | null
          id?: string
          investor_id?: string | null
          last_co_investment_date?: string | null
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          co_investments_count?: number | null
          connected_investor_id?: string | null
          connection_strength?: number | null
          connection_type?: string
          created_at?: string | null
          id?: string
          investor_id?: string | null
          last_co_investment_date?: string | null
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_connections_connected_investor_id_fkey"
            columns: ["connected_investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_connections_connected_investor_id_fkey"
            columns: ["connected_investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_connections_connected_investor_id_fkey"
            columns: ["connected_investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_connections_connected_investor_id_fkey"
            columns: ["connected_investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_connections_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_connections_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_connections_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_connections_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_discovery_flow: {
        Row: {
          alignment_state: string
          created_at: string | null
          first_appeared_at: string | null
          geography: string | null
          id: string
          industry: string
          investor_id: string
          last_signal_at: string | null
          signal_count: number | null
          signals_present: string[] | null
          stage: string
          startup_id: string | null
          startup_type_label: string
          trend: string | null
          updated_at: string | null
          why_appeared: string | null
        }
        Insert: {
          alignment_state: string
          created_at?: string | null
          first_appeared_at?: string | null
          geography?: string | null
          id?: string
          industry: string
          investor_id: string
          last_signal_at?: string | null
          signal_count?: number | null
          signals_present?: string[] | null
          stage: string
          startup_id?: string | null
          startup_type_label: string
          trend?: string | null
          updated_at?: string | null
          why_appeared?: string | null
        }
        Update: {
          alignment_state?: string
          created_at?: string | null
          first_appeared_at?: string | null
          geography?: string | null
          id?: string
          industry?: string
          investor_id?: string
          last_signal_at?: string | null
          signal_count?: number | null
          signals_present?: string[] | null
          stage?: string
          startup_id?: string | null
          startup_type_label?: string
          trend?: string | null
          updated_at?: string | null
          why_appeared?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_discovery_flow_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_discovery_flow_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_discovery_flow_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_discovery_flow_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_entry_path_distribution: {
        Row: {
          avg_alignment_quality: number | null
          conversion_rate: number | null
          created_at: string | null
          entry_path: string
          id: string
          investor_id: string
          occurrence_count: number | null
          path_label: string
          percentage: number | null
          updated_at: string | null
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          avg_alignment_quality?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          entry_path: string
          id?: string
          investor_id: string
          occurrence_count?: number | null
          path_label: string
          percentage?: number | null
          updated_at?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          avg_alignment_quality?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          entry_path?: string
          id?: string
          investor_id?: string
          occurrence_count?: number | null
          path_label?: string
          percentage?: number | null
          updated_at?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_entry_path_distribution_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_entry_path_distribution_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_entry_path_distribution_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_entry_path_distribution_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_events: {
        Row: {
          archetype: Database["public"]["Enums"]["investor_archetype"] | null
          event_type: Database["public"]["Enums"]["investor_event_type"]
          id: number
          investor_id: string
          investor_tier: string
          metadata: Json
          occurred_at: string
          startup_id: string
        }
        Insert: {
          archetype?: Database["public"]["Enums"]["investor_archetype"] | null
          event_type: Database["public"]["Enums"]["investor_event_type"]
          id?: number
          investor_id: string
          investor_tier?: string
          metadata?: Json
          occurred_at?: string
          startup_id: string
        }
        Update: {
          archetype?: Database["public"]["Enums"]["investor_archetype"] | null
          event_type?: Database["public"]["Enums"]["investor_event_type"]
          id?: number
          investor_id?: string
          investor_tier?: string
          metadata?: Json
          occurred_at?: string
          startup_id?: string
        }
        Relationships: []
      }
      investor_inbound_feedback: {
        Row: {
          alignment_state_at_feedback: string | null
          created_at: string | null
          discovery_flow_id: string
          feedback_type: string
          id: string
          investor_id: string
          signals_at_feedback: string[] | null
        }
        Insert: {
          alignment_state_at_feedback?: string | null
          created_at?: string | null
          discovery_flow_id: string
          feedback_type: string
          id?: string
          investor_id: string
          signals_at_feedback?: string[] | null
        }
        Update: {
          alignment_state_at_feedback?: string | null
          created_at?: string | null
          discovery_flow_id?: string
          feedback_type?: string
          id?: string
          investor_id?: string
          signals_at_feedback?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_inbound_feedback_discovery_flow_id_fkey"
            columns: ["discovery_flow_id"]
            isOneToOne: false
            referencedRelation: "investor_discovery_flow"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_inbound_feedback_discovery_flow_id_fkey"
            columns: ["discovery_flow_id"]
            isOneToOne: false
            referencedRelation: "investor_discovery_flow_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_inbound_feedback_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_inbound_feedback_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_inbound_feedback_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_inbound_feedback_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_investments: {
        Row: {
          amount: string | null
          co_investors: Json | null
          company_description: string | null
          company_name: string
          company_url: string | null
          created_at: string | null
          exit_date: string | null
          exit_details: string | null
          id: string
          industries: Json | null
          investment_date: string | null
          investor_id: string
          is_lead: boolean | null
          partner_id: string | null
          round_type: string | null
          scraped_date: string | null
          source_url: string | null
          startup_id: string | null
          status: string | null
          updated_at: string | null
          valuation: string | null
        }
        Insert: {
          amount?: string | null
          co_investors?: Json | null
          company_description?: string | null
          company_name: string
          company_url?: string | null
          created_at?: string | null
          exit_date?: string | null
          exit_details?: string | null
          id?: string
          industries?: Json | null
          investment_date?: string | null
          investor_id: string
          is_lead?: boolean | null
          partner_id?: string | null
          round_type?: string | null
          scraped_date?: string | null
          source_url?: string | null
          startup_id?: string | null
          status?: string | null
          updated_at?: string | null
          valuation?: string | null
        }
        Update: {
          amount?: string | null
          co_investors?: Json | null
          company_description?: string | null
          company_name?: string
          company_url?: string | null
          created_at?: string | null
          exit_date?: string | null
          exit_details?: string | null
          id?: string
          industries?: Json | null
          investment_date?: string | null
          investor_id?: string
          is_lead?: boolean | null
          partner_id?: string | null
          round_type?: string | null
          scraped_date?: string | null
          source_url?: string | null
          startup_id?: string | null
          status?: string | null
          updated_at?: string | null
          valuation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_investments_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_investments_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_investments_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_investments_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_investments_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "investor_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_investments_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "investor_investments_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "investor_investments_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "investor_investments_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_investments_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_investments_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_investments_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_investments_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_investments_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_investments_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_investments_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_investments_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_investments_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_investments_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "investor_investments_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_investments_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_investments_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_learned_preferences: {
        Row: {
          confidence: number | null
          created_at: string | null
          embedding_1536: string | null
          geography_affinity: Json | null
          id: string
          investor_id: string | null
          negative_feedback_count: number | null
          positive_feedback_count: number | null
          sector_affinity: Json | null
          stage_affinity: Json | null
          total_feedback_count: number | null
          updated_at: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          embedding_1536?: string | null
          geography_affinity?: Json | null
          id?: string
          investor_id?: string | null
          negative_feedback_count?: number | null
          positive_feedback_count?: number | null
          sector_affinity?: Json | null
          stage_affinity?: Json | null
          total_feedback_count?: number | null
          updated_at?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          embedding_1536?: string | null
          geography_affinity?: Json | null
          id?: string
          investor_id?: string | null
          negative_feedback_count?: number | null
          positive_feedback_count?: number | null
          sector_affinity?: Json | null
          stage_affinity?: Json | null
          total_feedback_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_learned_preferences_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: true
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_learned_preferences_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: true
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_learned_preferences_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: true
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_learned_preferences_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: true
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_mentions_raw: {
        Row: {
          confidence: number | null
          context_snippet: string | null
          created_at: string | null
          extraction_method: string | null
          firm: string | null
          id: string
          mention_text: string
          name: string | null
          promoted_to_entity_id: string | null
          source_url: string | null
          updated_at: string | null
          validation_confidence: number | null
          validation_reason: string | null
        }
        Insert: {
          confidence?: number | null
          context_snippet?: string | null
          created_at?: string | null
          extraction_method?: string | null
          firm?: string | null
          id?: string
          mention_text: string
          name?: string | null
          promoted_to_entity_id?: string | null
          source_url?: string | null
          updated_at?: string | null
          validation_confidence?: number | null
          validation_reason?: string | null
        }
        Update: {
          confidence?: number | null
          context_snippet?: string | null
          created_at?: string | null
          extraction_method?: string | null
          firm?: string | null
          id?: string
          mention_text?: string
          name?: string | null
          promoted_to_entity_id?: string | null
          source_url?: string | null
          updated_at?: string | null
          validation_confidence?: number | null
          validation_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_mentions_raw_promoted_to_entity_id_fkey"
            columns: ["promoted_to_entity_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_mentions_raw_promoted_to_entity_id_fkey"
            columns: ["promoted_to_entity_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_mentions_raw_promoted_to_entity_id_fkey"
            columns: ["promoted_to_entity_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_mentions_raw_promoted_to_entity_id_fkey"
            columns: ["promoted_to_entity_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_news: {
        Row: {
          author: string | null
          content: string | null
          created_at: string | null
          entities: Json | null
          id: string
          image_url: string | null
          investor_id: string
          is_featured: boolean | null
          is_published: boolean | null
          published_date: string | null
          scraped_date: string | null
          sentiment: string | null
          source: string | null
          source_type: string | null
          summary: string | null
          title: string
          topics: Json | null
          updated_at: string | null
          url: string
        }
        Insert: {
          author?: string | null
          content?: string | null
          created_at?: string | null
          entities?: Json | null
          id?: string
          image_url?: string | null
          investor_id: string
          is_featured?: boolean | null
          is_published?: boolean | null
          published_date?: string | null
          scraped_date?: string | null
          sentiment?: string | null
          source?: string | null
          source_type?: string | null
          summary?: string | null
          title: string
          topics?: Json | null
          updated_at?: string | null
          url: string
        }
        Update: {
          author?: string | null
          content?: string | null
          created_at?: string | null
          entities?: Json | null
          id?: string
          image_url?: string | null
          investor_id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          published_date?: string | null
          scraped_date?: string | null
          sentiment?: string | null
          source?: string | null
          source_type?: string | null
          summary?: string | null
          title?: string
          topics?: Json | null
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_news_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_news_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_news_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_news_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_observatory_access: {
        Row: {
          access_granted: boolean | null
          access_level: string | null
          created_at: string | null
          disabled_at: string | null
          disabled_reason: string | null
          email_reports_enabled: boolean | null
          expires_at: string | null
          id: string
          investor_id: string
          invite_code: string | null
          invited_by: string | null
          is_enabled: boolean | null
          report_frequency: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          access_granted?: boolean | null
          access_level?: string | null
          created_at?: string | null
          disabled_at?: string | null
          disabled_reason?: string | null
          email_reports_enabled?: boolean | null
          expires_at?: string | null
          id?: string
          investor_id: string
          invite_code?: string | null
          invited_by?: string | null
          is_enabled?: boolean | null
          report_frequency?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          access_granted?: boolean | null
          access_level?: string | null
          created_at?: string | null
          disabled_at?: string | null
          disabled_reason?: string | null
          email_reports_enabled?: boolean | null
          expires_at?: string | null
          id?: string
          investor_id?: string
          invite_code?: string | null
          invited_by?: string | null
          is_enabled?: boolean | null
          report_frequency?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_observatory_access_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: true
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_observatory_access_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: true
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_observatory_access_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: true
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_observatory_access_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: true
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_observatory_sessions: {
        Row: {
          created_at: string | null
          feedback_given: number | null
          id: string
          investor_id: string
          items_viewed: number | null
          sections_visited: string[] | null
          session_end: string | null
          session_start: string | null
          time_on_page_seconds: number | null
        }
        Insert: {
          created_at?: string | null
          feedback_given?: number | null
          id?: string
          investor_id: string
          items_viewed?: number | null
          sections_visited?: string[] | null
          session_end?: string | null
          session_start?: string | null
          time_on_page_seconds?: number | null
        }
        Update: {
          created_at?: string | null
          feedback_given?: number | null
          id?: string
          investor_id?: string
          items_viewed?: number | null
          sections_visited?: string[] | null
          session_end?: string | null
          session_start?: string | null
          time_on_page_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_observatory_sessions_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_observatory_sessions_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_observatory_sessions_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_observatory_sessions_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_observatory_telemetry: {
        Row: {
          avg_session_duration_seconds: number | null
          avg_time_to_first_feedback_seconds: number | null
          created_at: string | null
          date: string
          feedback_events: number | null
          feedback_good_inbound: number | null
          feedback_not_relevant: number | null
          feedback_rate: number | null
          feedback_too_early: number | null
          flow_items_generated: number | null
          id: string
          too_early_rate: number | null
          total_impressions: number | null
          unique_sessions: number | null
        }
        Insert: {
          avg_session_duration_seconds?: number | null
          avg_time_to_first_feedback_seconds?: number | null
          created_at?: string | null
          date?: string
          feedback_events?: number | null
          feedback_good_inbound?: number | null
          feedback_not_relevant?: number | null
          feedback_rate?: number | null
          feedback_too_early?: number | null
          flow_items_generated?: number | null
          id?: string
          too_early_rate?: number | null
          total_impressions?: number | null
          unique_sessions?: number | null
        }
        Update: {
          avg_session_duration_seconds?: number | null
          avg_time_to_first_feedback_seconds?: number | null
          created_at?: string | null
          date?: string
          feedback_events?: number | null
          feedback_good_inbound?: number | null
          feedback_not_relevant?: number | null
          feedback_rate?: number | null
          feedback_too_early?: number | null
          flow_items_generated?: number | null
          id?: string
          too_early_rate?: number | null
          total_impressions?: number | null
          unique_sessions?: number | null
        }
        Relationships: []
      }
      investor_partners: {
        Row: {
          bio: string | null
          created_at: string | null
          email: string | null
          focus_areas: Json | null
          geography_focus: Json | null
          id: string
          image_url: string | null
          investor_id: string
          is_active: boolean | null
          joined_date: string | null
          linkedin_url: string | null
          name: string
          stage_preference: Json | null
          title: string | null
          twitter_handle: string | null
          updated_at: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          email?: string | null
          focus_areas?: Json | null
          geography_focus?: Json | null
          id?: string
          image_url?: string | null
          investor_id: string
          is_active?: boolean | null
          joined_date?: string | null
          linkedin_url?: string | null
          name: string
          stage_preference?: Json | null
          title?: string | null
          twitter_handle?: string | null
          updated_at?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          email?: string | null
          focus_areas?: Json | null
          geography_focus?: Json | null
          id?: string
          image_url?: string | null
          investor_id?: string
          is_active?: boolean | null
          joined_date?: string | null
          linkedin_url?: string | null
          name?: string
          stage_preference?: Json | null
          title?: string | null
          twitter_handle?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_partners_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_partners_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_partners_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_partners_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_playbooks: {
        Row: {
          approach_style: string | null
          best_contact_method: string | null
          created_at: string | null
          id: string
          investor_id: string
          partner_preferences: Json | null
          recent_investments: Json | null
          red_flags: Json | null
          sample_cold_email: string | null
          typical_response_time: string | null
          updated_at: string | null
          warm_intro_paths: Json | null
          what_they_look_for: Json | null
        }
        Insert: {
          approach_style?: string | null
          best_contact_method?: string | null
          created_at?: string | null
          id?: string
          investor_id: string
          partner_preferences?: Json | null
          recent_investments?: Json | null
          red_flags?: Json | null
          sample_cold_email?: string | null
          typical_response_time?: string | null
          updated_at?: string | null
          warm_intro_paths?: Json | null
          what_they_look_for?: Json | null
        }
        Update: {
          approach_style?: string | null
          best_contact_method?: string | null
          created_at?: string | null
          id?: string
          investor_id?: string
          partner_preferences?: Json | null
          recent_investments?: Json | null
          red_flags?: Json | null
          sample_cold_email?: string | null
          typical_response_time?: string | null
          updated_at?: string | null
          warm_intro_paths?: Json | null
          what_they_look_for?: Json | null
        }
        Relationships: []
      }
      investor_portfolio_adjacency: {
        Row: {
          adjacent_companies: number | null
          investor_id: string
          last_updated: string | null
          overlap_score: number | null
          shared_sectors: string[] | null
          startup_id: string
        }
        Insert: {
          adjacent_companies?: number | null
          investor_id: string
          last_updated?: string | null
          overlap_score?: number | null
          shared_sectors?: string[] | null
          startup_id: string
        }
        Update: {
          adjacent_companies?: number | null
          investor_id?: string
          last_updated?: string | null
          overlap_score?: number | null
          shared_sectors?: string[] | null
          startup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_portfolio_adjacency_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_portfolio_adjacency_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_portfolio_adjacency_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_portfolio_adjacency_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_portfolio_adjacency_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "investor_portfolio_adjacency_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "investor_portfolio_adjacency_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "investor_portfolio_adjacency_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_portfolio_adjacency_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_portfolio_adjacency_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_portfolio_adjacency_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_portfolio_adjacency_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_portfolio_adjacency_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_portfolio_adjacency_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_portfolio_adjacency_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_portfolio_adjacency_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_portfolio_adjacency_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_portfolio_adjacency_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "investor_portfolio_adjacency_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_portfolio_adjacency_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_portfolio_adjacency_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_preparation_profiles: {
        Row: {
          average_response_time_days: number | null
          confidence_level: string | null
          created_at: string | null
          dominant_signals: string[] | null
          engagement_triggers: string[] | null
          entry_paths_ranked: Json | null
          id: string
          investor_id: string
          last_updated_at: string | null
          negative_signals: string[] | null
          secondary_signals: string[] | null
          timing_sensitivity: string | null
          typical_first_meeting_format: string | null
          typical_timing_triggers: string[] | null
        }
        Insert: {
          average_response_time_days?: number | null
          confidence_level?: string | null
          created_at?: string | null
          dominant_signals?: string[] | null
          engagement_triggers?: string[] | null
          entry_paths_ranked?: Json | null
          id?: string
          investor_id: string
          last_updated_at?: string | null
          negative_signals?: string[] | null
          secondary_signals?: string[] | null
          timing_sensitivity?: string | null
          typical_first_meeting_format?: string | null
          typical_timing_triggers?: string[] | null
        }
        Update: {
          average_response_time_days?: number | null
          confidence_level?: string | null
          created_at?: string | null
          dominant_signals?: string[] | null
          engagement_triggers?: string[] | null
          entry_paths_ranked?: Json | null
          id?: string
          investor_id?: string
          last_updated_at?: string | null
          negative_signals?: string[] | null
          secondary_signals?: string[] | null
          timing_sensitivity?: string | null
          typical_first_meeting_format?: string | null
          typical_timing_triggers?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_preparation_profiles_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: true
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_preparation_profiles_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: true
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_preparation_profiles_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: true
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_preparation_profiles_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: true
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_quality_drift: {
        Row: {
          active_count: number | null
          active_percentage: number | null
          created_at: string | null
          forming_count: number | null
          forming_percentage: number | null
          id: string
          investor_id: string
          quality_score: number | null
          strong_count: number | null
          strong_percentage: number | null
          total_inbound: number | null
          trend_direction: string | null
          week_bucket: string
          week_over_week_change: number | null
        }
        Insert: {
          active_count?: number | null
          active_percentage?: number | null
          created_at?: string | null
          forming_count?: number | null
          forming_percentage?: number | null
          id?: string
          investor_id: string
          quality_score?: number | null
          strong_count?: number | null
          strong_percentage?: number | null
          total_inbound?: number | null
          trend_direction?: string | null
          week_bucket: string
          week_over_week_change?: number | null
        }
        Update: {
          active_count?: number | null
          active_percentage?: number | null
          created_at?: string | null
          forming_count?: number | null
          forming_percentage?: number | null
          id?: string
          investor_id?: string
          quality_score?: number | null
          strong_count?: number | null
          strong_percentage?: number | null
          total_inbound?: number | null
          trend_direction?: string | null
          week_bucket?: string
          week_over_week_change?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_quality_drift_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_quality_drift_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_quality_drift_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_quality_drift_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_signal_distribution: {
        Row: {
          created_at: string | null
          id: string
          investor_id: string
          occurrence_count: number | null
          percentage: number | null
          previous_percentage: number | null
          signal_label: string
          signal_type: string
          trend_direction: string | null
          updated_at: string | null
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          investor_id: string
          occurrence_count?: number | null
          percentage?: number | null
          previous_percentage?: number | null
          signal_label: string
          signal_type: string
          trend_direction?: string | null
          updated_at?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          investor_id?: string
          occurrence_count?: number | null
          percentage?: number | null
          previous_percentage?: number | null
          signal_label?: string
          signal_type?: string
          trend_direction?: string | null
          updated_at?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_signal_distribution_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_signal_distribution_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_signal_distribution_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_signal_distribution_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_startup_observers: {
        Row: {
          id: string
          investor_id: string
          meta: Json | null
          occurred_at: string
          source: string
          startup_id: string
          weight: number
        }
        Insert: {
          id?: string
          investor_id: string
          meta?: Json | null
          occurred_at?: string
          source: string
          startup_id: string
          weight?: number
        }
        Update: {
          id?: string
          investor_id?: string
          meta?: Json | null
          occurred_at?: string
          source?: string
          startup_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "investor_startup_observers_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_startup_observers_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_startup_observers_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_tier_weights: {
        Row: {
          investor_tier: string
          weight: number
        }
        Insert: {
          investor_tier: string
          weight: number
        }
        Update: {
          investor_tier?: string
          weight?: number
        }
        Relationships: []
      }
      investors: {
        Row: {
          active_fund_size: number | null
          avg_response_time_days: number | null
          bio: string | null
          blog_url: string | null
          board_seats: number | null
          check_size_max: number | null
          check_size_min: number | null
          created_at: string | null
          created_by: string | null
          crunchbase_url: string | null
          decision_maker: boolean | null
          decision_speed: string | null
          dry_powder_estimate: number | null
          email: string | null
          embedding: string | null
          firm: string | null
          firm_description_normalized: string | null
          focus_areas: Json | null
          follows_rounds: boolean | null
          geography_focus: string[] | null
          id: string
          investment_firm_description: string | null
          investment_pace_per_year: number | null
          investment_thesis: string | null
          investor_score: number | null
          investor_tier: string | null
          investor_type: string | null
          is_individual: boolean | null
          is_verified: boolean | null
          last_enrichment_date: string | null
          last_investment_date: string | null
          last_news_update: string | null
          last_scored_at: string | null
          leads_rounds: boolean | null
          linkedin_url: string | null
          name: string
          news_feed_url: string | null
          notable_investments: Json | null
          partner_id: string | null
          partners: Json | null
          photo_url: string | null
          portfolio_companies: string[] | null
          portfolio_performance: Json | null
          preferred_intro_method: string | null
          primary_motivation: string | null
          score_breakdown: Json | null
          score_signals: string[] | null
          sectors: string[] | null
          signals: Json | null
          stage: string[] | null
          startup_advice: Json | null
          status: string | null
          successful_exits: number | null
          tier: Database["public"]["Enums"]["investor_tier"]
          title: string | null
          total_investments: number | null
          twitter_handle: string | null
          twitter_url: string | null
          type: string | null
          typical_ownership_pct: number | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          active_fund_size?: number | null
          avg_response_time_days?: number | null
          bio?: string | null
          blog_url?: string | null
          board_seats?: number | null
          check_size_max?: number | null
          check_size_min?: number | null
          created_at?: string | null
          created_by?: string | null
          crunchbase_url?: string | null
          decision_maker?: boolean | null
          decision_speed?: string | null
          dry_powder_estimate?: number | null
          email?: string | null
          embedding?: string | null
          firm?: string | null
          firm_description_normalized?: string | null
          focus_areas?: Json | null
          follows_rounds?: boolean | null
          geography_focus?: string[] | null
          id?: string
          investment_firm_description?: string | null
          investment_pace_per_year?: number | null
          investment_thesis?: string | null
          investor_score?: number | null
          investor_tier?: string | null
          investor_type?: string | null
          is_individual?: boolean | null
          is_verified?: boolean | null
          last_enrichment_date?: string | null
          last_investment_date?: string | null
          last_news_update?: string | null
          last_scored_at?: string | null
          leads_rounds?: boolean | null
          linkedin_url?: string | null
          name: string
          news_feed_url?: string | null
          notable_investments?: Json | null
          partner_id?: string | null
          partners?: Json | null
          photo_url?: string | null
          portfolio_companies?: string[] | null
          portfolio_performance?: Json | null
          preferred_intro_method?: string | null
          primary_motivation?: string | null
          score_breakdown?: Json | null
          score_signals?: string[] | null
          sectors?: string[] | null
          signals?: Json | null
          stage?: string[] | null
          startup_advice?: Json | null
          status?: string | null
          successful_exits?: number | null
          tier?: Database["public"]["Enums"]["investor_tier"]
          title?: string | null
          total_investments?: number | null
          twitter_handle?: string | null
          twitter_url?: string | null
          type?: string | null
          typical_ownership_pct?: number | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          active_fund_size?: number | null
          avg_response_time_days?: number | null
          bio?: string | null
          blog_url?: string | null
          board_seats?: number | null
          check_size_max?: number | null
          check_size_min?: number | null
          created_at?: string | null
          created_by?: string | null
          crunchbase_url?: string | null
          decision_maker?: boolean | null
          decision_speed?: string | null
          dry_powder_estimate?: number | null
          email?: string | null
          embedding?: string | null
          firm?: string | null
          firm_description_normalized?: string | null
          focus_areas?: Json | null
          follows_rounds?: boolean | null
          geography_focus?: string[] | null
          id?: string
          investment_firm_description?: string | null
          investment_pace_per_year?: number | null
          investment_thesis?: string | null
          investor_score?: number | null
          investor_tier?: string | null
          investor_type?: string | null
          is_individual?: boolean | null
          is_verified?: boolean | null
          last_enrichment_date?: string | null
          last_investment_date?: string | null
          last_news_update?: string | null
          last_scored_at?: string | null
          leads_rounds?: boolean | null
          linkedin_url?: string | null
          name?: string
          news_feed_url?: string | null
          notable_investments?: Json | null
          partner_id?: string | null
          partners?: Json | null
          photo_url?: string | null
          portfolio_companies?: string[] | null
          portfolio_performance?: Json | null
          preferred_intro_method?: string | null
          primary_motivation?: string | null
          score_breakdown?: Json | null
          score_signals?: string[] | null
          sectors?: string[] | null
          signals?: Json | null
          stage?: string[] | null
          startup_advice?: Json | null
          status?: string | null
          successful_exits?: number | null
          tier?: Database["public"]["Enums"]["investor_tier"]
          title?: string | null
          total_investments?: number | null
          twitter_handle?: string | null
          twitter_url?: string | null
          type?: string | null
          typical_ownership_pct?: number | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      key_variables_tracking: {
        Row: {
          calculation_method: string | null
          created_at: string | null
          geography: string | null
          id: string
          measurement_date: string
          sample_size: number | null
          sector: string | null
          stage: string | null
          value: number | null
          value_json: Json | null
          variable_category: string
          variable_name: string
        }
        Insert: {
          calculation_method?: string | null
          created_at?: string | null
          geography?: string | null
          id?: string
          measurement_date: string
          sample_size?: number | null
          sector?: string | null
          stage?: string | null
          value?: number | null
          value_json?: Json | null
          variable_category: string
          variable_name: string
        }
        Update: {
          calculation_method?: string | null
          created_at?: string | null
          geography?: string | null
          id?: string
          measurement_date?: string
          sample_size?: number | null
          sector?: string | null
          stage?: string | null
          value?: number | null
          value_json?: Json | null
          variable_category?: string
          variable_name?: string
        }
        Relationships: []
      }
      linguistic_patterns: {
        Row: {
          created_at: string
          examples: string[]
          id: string
          pattern_regex: string
          pattern_type: string
        }
        Insert: {
          created_at?: string
          examples: string[]
          id?: string
          pattern_regex: string
          pattern_type: string
        }
        Update: {
          created_at?: string
          examples?: string[]
          id?: string
          pattern_regex?: string
          pattern_type?: string
        }
        Relationships: []
      }
      market_events: {
        Row: {
          announced_at: string | null
          confidence: number
          created_at: string
          detected_at: string
          effective_at: string | null
          event_type: string
          evidence: Json
          fingerprint: string | null
          geo_scope: string
          id: string
          inevitability: number
          keyword_tags: string[]
          sector_tags: string[]
          source_url: string | null
          summary: string | null
          title: string
          unlock_strength: number
        }
        Insert: {
          announced_at?: string | null
          confidence?: number
          created_at?: string
          detected_at?: string
          effective_at?: string | null
          event_type: string
          evidence?: Json
          fingerprint?: string | null
          geo_scope?: string
          id?: string
          inevitability?: number
          keyword_tags?: string[]
          sector_tags?: string[]
          source_url?: string | null
          summary?: string | null
          title: string
          unlock_strength?: number
        }
        Update: {
          announced_at?: string | null
          confidence?: number
          created_at?: string
          detected_at?: string
          effective_at?: string | null
          event_type?: string
          evidence?: Json
          fingerprint?: string | null
          geo_scope?: string
          id?: string
          inevitability?: number
          keyword_tags?: string[]
          sector_tags?: string[]
          source_url?: string | null
          summary?: string | null
          title?: string
          unlock_strength?: number
        }
        Relationships: []
      }
      market_intelligence: {
        Row: {
          calculation_method: string | null
          confidence_score: number | null
          created_at: string | null
          data_source: string | null
          geography: string | null
          id: string
          metric_category: string | null
          metric_name: string
          metric_type: string
          metric_value: Json
          period_end: string
          period_start: string
          sector: string | null
          stage: string | null
          updated_at: string | null
        }
        Insert: {
          calculation_method?: string | null
          confidence_score?: number | null
          created_at?: string | null
          data_source?: string | null
          geography?: string | null
          id?: string
          metric_category?: string | null
          metric_name: string
          metric_type: string
          metric_value: Json
          period_end: string
          period_start: string
          sector?: string | null
          stage?: string | null
          updated_at?: string | null
        }
        Update: {
          calculation_method?: string | null
          confidence_score?: number | null
          created_at?: string | null
          data_source?: string | null
          geography?: string | null
          id?: string
          metric_category?: string | null
          metric_name?: string
          metric_type?: string
          metric_value?: Json
          period_end?: string
          period_start?: string
          sector?: string | null
          stage?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      market_problems: {
        Row: {
          created_at: string | null
          id: string
          industry: string
          keywords: string[] | null
          problem_description: string | null
          problem_rank: number
          problem_title: string
          severity_score: number | null
          source_urls: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          industry: string
          keywords?: string[] | null
          problem_description?: string | null
          problem_rank: number
          problem_title: string
          severity_score?: number | null
          source_urls?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          industry?: string
          keywords?: string[] | null
          problem_description?: string | null
          problem_rank?: number
          problem_title?: string
          severity_score?: number | null
          source_urls?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      match_feedback: {
        Row: {
          context: Json | null
          created_at: string | null
          feedback_type: string
          feedback_value: number
          id: string
          investor_id: string | null
          match_id: string | null
          source: string | null
          startup_id: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          feedback_type: string
          feedback_value: number
          id?: string
          investor_id?: string | null
          match_id?: string | null
          source?: string | null
          startup_id?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          feedback_type?: string
          feedback_value?: number
          id?: string
          investor_id?: string | null
          match_id?: string | null
          source?: string | null
          startup_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_feedback_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "match_feedback_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "match_feedback_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_feedback_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "match_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "match_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "match_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "match_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      match_generation_queue: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string | null
          id: string
          last_error: string | null
          priority: number | null
          startup_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          last_error?: string | null
          priority?: number | null
          startup_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          last_error?: string | null
          priority?: number | null
          startup_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_generation_queue_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "match_generation_queue_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "match_generation_queue_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "match_generation_queue_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_generation_queue_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_generation_queue_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_generation_queue_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_generation_queue_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_generation_queue_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_generation_queue_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_generation_queue_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_generation_queue_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_generation_queue_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_generation_queue_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "match_generation_queue_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_generation_queue_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_generation_queue_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      match_previews: {
        Row: {
          created_at: string | null
          id: string
          investor_id: string | null
          match_reasons: Json | null
          match_score: number
          prospect_id: string | null
          shown_in_email: boolean | null
          unlocked: boolean | null
          unlocked_at: string | null
          viewed: boolean | null
          viewed_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          investor_id?: string | null
          match_reasons?: Json | null
          match_score: number
          prospect_id?: string | null
          shown_in_email?: boolean | null
          unlocked?: boolean | null
          unlocked_at?: string | null
          viewed?: boolean | null
          viewed_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          investor_id?: string | null
          match_reasons?: Json | null
          match_score?: number
          prospect_id?: string | null
          shown_in_email?: boolean | null
          unlocked?: boolean | null
          unlocked_at?: string | null
          viewed?: boolean | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_previews_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "match_previews_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "match_previews_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_previews_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_previews_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "outreach_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      match_reports: {
        Row: {
          created_at: string | null
          id: string
          metrics: Json
          period_end: string
          period_start: string
          report_type: string
          top_matches: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          metrics?: Json
          period_end: string
          period_start: string
          report_type: string
          top_matches?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          metrics?: Json
          period_end?: string
          period_start?: string
          report_type?: string
          top_matches?: Json | null
        }
        Relationships: []
      }
      matching_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          error_message: string | null
          id: string
          processed_at: string | null
          startup_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          processed_at?: string | null
          startup_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          processed_at?: string | null
          startup_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      metric_definitions: {
        Row: {
          category: string
          definition: string
          good_benchmark: string | null
          how_to_calculate: string | null
          id: number
          metric_name: string
          source: string | null
          warning_signs: string[] | null
          why_it_matters: string | null
        }
        Insert: {
          category: string
          definition: string
          good_benchmark?: string | null
          how_to_calculate?: string | null
          id?: number
          metric_name: string
          source?: string | null
          warning_signs?: string[] | null
          why_it_matters?: string | null
        }
        Update: {
          category?: string
          definition?: string
          good_benchmark?: string | null
          how_to_calculate?: string | null
          id?: number
          metric_name?: string
          source?: string | null
          warning_signs?: string[] | null
          why_it_matters?: string | null
        }
        Relationships: []
      }
      ml_recommendations: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          confidence_score: number | null
          created_at: string | null
          current_value: Json | null
          description: string | null
          expected_impact: string | null
          id: string
          priority: string
          proposed_value: Json | null
          recommendation_type: string
          status: string | null
          title: string
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          confidence_score?: number | null
          created_at?: string | null
          current_value?: Json | null
          description?: string | null
          expected_impact?: string | null
          id?: string
          priority: string
          proposed_value?: Json | null
          recommendation_type: string
          status?: string | null
          title: string
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          confidence_score?: number | null
          created_at?: string | null
          current_value?: Json | null
          description?: string | null
          expected_impact?: string | null
          id?: string
          priority?: string
          proposed_value?: Json | null
          recommendation_type?: string
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      notification_indicators: {
        Row: {
          founder_session_id: string | null
          id: string
          last_seen_at: string | null
          startup_url: string | null
          unread_count: number
          updated_at: string
        }
        Insert: {
          founder_session_id?: string | null
          id?: string
          last_seen_at?: string | null
          startup_url?: string | null
          unread_count?: number
          updated_at?: string
        }
        Update: {
          founder_session_id?: string | null
          id?: string
          last_seen_at?: string | null
          startup_url?: string | null
          unread_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          created_at: string
          founder_session_id: string | null
          id: string
          priority: number
          processed_at: string | null
          startup_id: string | null
          startup_url: string | null
          trigger_data: Json
          trigger_date: string
          trigger_type: string
        }
        Insert: {
          created_at?: string
          founder_session_id?: string | null
          id?: string
          priority?: number
          processed_at?: string | null
          startup_id?: string | null
          startup_url?: string | null
          trigger_data?: Json
          trigger_date?: string
          trigger_type: string
        }
        Update: {
          created_at?: string
          founder_session_id?: string | null
          id?: string
          priority?: number
          processed_at?: string | null
          startup_id?: string | null
          startup_url?: string | null
          trigger_data?: Json
          trigger_date?: string
          trigger_type?: string
        }
        Relationships: []
      }
      notification_triggers: {
        Row: {
          bullet_template: string
          category: string
          created_at: string
          default_enabled: boolean
          description: string | null
          id: string
          is_enabled: boolean
          priority: number
          trigger_type: string
          updated_at: string
        }
        Insert: {
          bullet_template: string
          category: string
          created_at?: string
          default_enabled?: boolean
          description?: string | null
          id?: string
          is_enabled?: boolean
          priority?: number
          trigger_type: string
          updated_at?: string
        }
        Update: {
          bullet_template?: string
          category?: string
          created_at?: string
          default_enabled?: boolean
          description?: string | null
          id?: string
          is_enabled?: boolean
          priority?: number
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          email_error: string | null
          email_sent_at: string | null
          email_status: string | null
          entity_id: string | null
          entity_type: string
          id: string
          is_read: boolean
          kind: string
          payload: Json
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string | null
          email_error?: string | null
          email_sent_at?: string | null
          email_status?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          is_read?: boolean
          kind?: string
          payload?: Json
          title?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          email_error?: string | null
          email_sent_at?: string | null
          email_status?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          is_read?: boolean
          kind?: string
          payload?: Json
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      outreach_campaigns: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          email_subject: string | null
          email_template: string | null
          frequency: string | null
          id: string
          last_run_at: string | null
          matches_per_startup: number | null
          name: string
          next_run_at: string | null
          scheduled_date: string | null
          send_from_email: string | null
          send_from_name: string | null
          status: string | null
          target_audience: string | null
          total_clicked: number | null
          total_conversions: number | null
          total_opened: number | null
          total_revenue: number | null
          total_sent: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          email_subject?: string | null
          email_template?: string | null
          frequency?: string | null
          id?: string
          last_run_at?: string | null
          matches_per_startup?: number | null
          name: string
          next_run_at?: string | null
          scheduled_date?: string | null
          send_from_email?: string | null
          send_from_name?: string | null
          status?: string | null
          target_audience?: string | null
          total_clicked?: number | null
          total_conversions?: number | null
          total_opened?: number | null
          total_revenue?: number | null
          total_sent?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          email_subject?: string | null
          email_template?: string | null
          frequency?: string | null
          id?: string
          last_run_at?: string | null
          matches_per_startup?: number | null
          name?: string
          next_run_at?: string | null
          scheduled_date?: string | null
          send_from_email?: string | null
          send_from_name?: string | null
          status?: string | null
          target_audience?: string | null
          total_clicked?: number | null
          total_conversions?: number | null
          total_opened?: number | null
          total_revenue?: number | null
          total_sent?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      outreach_conversions: {
        Row: {
          amount_usd: number | null
          campaign_id: string | null
          conversion_type: string
          converted_at: string | null
          created_at: string | null
          days_to_convert: number | null
          email_id: string | null
          emails_received: number | null
          id: string
          prospect_id: string | null
          stripe_customer_id: string | null
          stripe_payment_id: string | null
          tier_id: string | null
          user_id: string | null
        }
        Insert: {
          amount_usd?: number | null
          campaign_id?: string | null
          conversion_type: string
          converted_at?: string | null
          created_at?: string | null
          days_to_convert?: number | null
          email_id?: string | null
          emails_received?: number | null
          id?: string
          prospect_id?: string | null
          stripe_customer_id?: string | null
          stripe_payment_id?: string | null
          tier_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount_usd?: number | null
          campaign_id?: string | null
          conversion_type?: string
          converted_at?: string | null
          created_at?: string | null
          days_to_convert?: number | null
          email_id?: string | null
          emails_received?: number | null
          id?: string
          prospect_id?: string | null
          stripe_customer_id?: string | null
          stripe_payment_id?: string | null
          tier_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_conversions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "outreach_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_conversions_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "outreach_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_conversions_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "outreach_prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_conversions_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "pricing_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_emails: {
        Row: {
          bounce_reason: string | null
          campaign_id: string | null
          click_count: number | null
          clicked_at: string | null
          created_at: string | null
          delivered_at: string | null
          email_provider_id: string | null
          error_message: string | null
          html_body: string
          id: string
          matches_data: Json | null
          open_count: number | null
          opened_at: string | null
          prospect_id: string | null
          review_token: string
          sent_at: string | null
          status: string | null
          subject: string
          text_body: string | null
          tracking_id: string
          updated_at: string | null
        }
        Insert: {
          bounce_reason?: string | null
          campaign_id?: string | null
          click_count?: number | null
          clicked_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          email_provider_id?: string | null
          error_message?: string | null
          html_body: string
          id?: string
          matches_data?: Json | null
          open_count?: number | null
          opened_at?: string | null
          prospect_id?: string | null
          review_token: string
          sent_at?: string | null
          status?: string | null
          subject: string
          text_body?: string | null
          tracking_id: string
          updated_at?: string | null
        }
        Update: {
          bounce_reason?: string | null
          campaign_id?: string | null
          click_count?: number | null
          clicked_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          email_provider_id?: string | null
          error_message?: string | null
          html_body?: string
          id?: string
          matches_data?: Json | null
          open_count?: number | null
          opened_at?: string | null
          prospect_id?: string | null
          review_token?: string
          sent_at?: string | null
          status?: string | null
          subject?: string
          text_body?: string | null
          tracking_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_emails_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "outreach_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_emails_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "outreach_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_prospects: {
        Row: {
          clicked_count: number | null
          company_name: string | null
          created_at: string | null
          email: string
          employee_count: number | null
          first_contacted_at: string | null
          founded_year: number | null
          founder_name: string | null
          funding_amount: string | null
          id: string
          industry: string | null
          last_contacted_at: string | null
          linkedin_url: string | null
          opened_count: number | null
          pitch: string | null
          replied: boolean | null
          source: string | null
          source_url: string | null
          stage: string | null
          status: string | null
          twitter_url: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          clicked_count?: number | null
          company_name?: string | null
          created_at?: string | null
          email: string
          employee_count?: number | null
          first_contacted_at?: string | null
          founded_year?: number | null
          founder_name?: string | null
          funding_amount?: string | null
          id?: string
          industry?: string | null
          last_contacted_at?: string | null
          linkedin_url?: string | null
          opened_count?: number | null
          pitch?: string | null
          replied?: boolean | null
          source?: string | null
          source_url?: string | null
          stage?: string | null
          status?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          clicked_count?: number | null
          company_name?: string | null
          created_at?: string | null
          email?: string
          employee_count?: number | null
          first_contacted_at?: string | null
          founded_year?: number | null
          founder_name?: string | null
          funding_amount?: string | null
          id?: string
          industry?: string | null
          last_contacted_at?: string | null
          linkedin_url?: string | null
          opened_count?: number | null
          pitch?: string | null
          replied?: boolean | null
          source?: string | null
          source_url?: string | null
          stage?: string | null
          status?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      path_durability_stats: {
        Row: {
          archetype: string
          converted_count: number | null
          durability_label: string | null
          durability_score: number | null
          faded_count: number | null
          id: string
          industry: string | null
          last_computed_at: string | null
          sample_size: number | null
          stage: string | null
          sustained_3_months: number | null
          sustained_6_months: number | null
          total_stories: number | null
        }
        Insert: {
          archetype: string
          converted_count?: number | null
          durability_label?: string | null
          durability_score?: number | null
          faded_count?: number | null
          id?: string
          industry?: string | null
          last_computed_at?: string | null
          sample_size?: number | null
          stage?: string | null
          sustained_3_months?: number | null
          sustained_6_months?: number | null
          total_stories?: number | null
        }
        Update: {
          archetype?: string
          converted_count?: number | null
          durability_label?: string | null
          durability_score?: number | null
          faded_count?: number | null
          id?: string
          industry?: string | null
          last_computed_at?: string | null
          sample_size?: number | null
          stage?: string | null
          sustained_3_months?: number | null
          sustained_6_months?: number | null
          total_stories?: number | null
        }
        Relationships: []
      }
      payment_history: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          description: string | null
          id: string
          receipt_url: string | null
          status: string
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          receipt_url?: string | null
          status: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          receipt_url?: string | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      phase_archetypes: {
        Row: {
          archetype_key: string
          capital_weight: number
          customer_weight: number
          description: string
          human_weight: number
          market_weight: number
          product_weight: number
        }
        Insert: {
          archetype_key: string
          capital_weight?: number
          customer_weight?: number
          description: string
          human_weight?: number
          market_weight?: number
          product_weight?: number
        }
        Update: {
          archetype_key?: string
          capital_weight?: number
          customer_weight?: number
          description?: string
          human_weight?: number
          market_weight?: number
          product_weight?: number
        }
        Relationships: []
      }
      phase_decay_params: {
        Row: {
          domain: Database["public"]["Enums"]["phase_domain"]
          half_life_days: number
          min_multiplier: number
        }
        Insert: {
          domain: Database["public"]["Enums"]["phase_domain"]
          half_life_days: number
          min_multiplier?: number
        }
        Update: {
          domain?: Database["public"]["Enums"]["phase_domain"]
          half_life_days?: number
          min_multiplier?: number
        }
        Relationships: []
      }
      pipeline_errors: {
        Row: {
          context: Json | null
          error_message: string
          id: number
          occurred_at: string
          pipeline: string
        }
        Insert: {
          context?: Json | null
          error_message: string
          id?: number
          occurred_at?: string
          pipeline: string
        }
        Update: {
          context?: Json | null
          error_message?: string
          id?: number
          occurred_at?: string
          pipeline?: string
        }
        Relationships: []
      }
      pricing_markup_config: {
        Row: {
          config_key: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          markup_percentage: number
          updated_at: string | null
        }
        Insert: {
          config_key: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          markup_percentage?: number
          updated_at?: string | null
        }
        Update: {
          config_key?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          markup_percentage?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      pricing_tiers: {
        Row: {
          active: boolean | null
          billing_period: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          intro_emails: boolean | null
          matches_included: number | null
          matches_unlimited: boolean | null
          name: string
          pitch_review: boolean | null
          price_usd: number
          priority_placement: boolean | null
          slug: string
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          billing_period?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          intro_emails?: boolean | null
          matches_included?: number | null
          matches_unlimited?: boolean | null
          name: string
          pitch_review?: boolean | null
          price_usd: number
          priority_placement?: boolean | null
          slug: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          billing_period?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          intro_emails?: boolean | null
          matches_included?: number | null
          matches_unlimited?: boolean | null
          name?: string
          pitch_review?: boolean | null
          price_usd?: number
          priority_placement?: boolean | null
          slug?: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          digest_enabled: boolean | null
          digest_time_local: string | null
          email: string | null
          email_alerts_enabled: boolean | null
          id: string
          last_digest_sent_at: string | null
          plan: string
          plan_status: string | null
          preferences: Json | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          digest_enabled?: boolean | null
          digest_time_local?: string | null
          email?: string | null
          email_alerts_enabled?: boolean | null
          id: string
          last_digest_sent_at?: string | null
          plan?: string
          plan_status?: string | null
          preferences?: Json | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          digest_enabled?: boolean | null
          digest_time_local?: string | null
          email?: string | null
          email_alerts_enabled?: boolean | null
          id?: string
          last_digest_sent_at?: string | null
          plan?: string
          plan_status?: string | null
          preferences?: Json | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pythia_scores: {
        Row: {
          action_verb_count: number | null
          adjective_count: number | null
          adjective_verb_penalty: number | null
          computed_at: string | null
          confidence: number
          constraint_markers_count: number | null
          constraint_score: number | null
          context_diversity: number | null
          created_at: string | null
          customer_ontology: number | null
          dominance_ontology: number | null
          drive_ontology: number | null
          entity_id: string
          entity_type: string
          id: number
          mechanism_score: number | null
          mechanism_tokens_count: number | null
          narrative_no_constraint_penalty: number | null
          pythia_score: number
          reality_contact_score: number | null
          reality_markers_count: number | null
          snippet_count: number | null
          source_count: number | null
          sovereignty_ontology: number | null
          temporal_span_days: number | null
          tier1_pct: number | null
          tier2_pct: number | null
          tier3_pct: number | null
          unfalsifiable_penalty: number | null
          updated_at: string | null
          wow_ontology: number | null
        }
        Insert: {
          action_verb_count?: number | null
          adjective_count?: number | null
          adjective_verb_penalty?: number | null
          computed_at?: string | null
          confidence: number
          constraint_markers_count?: number | null
          constraint_score?: number | null
          context_diversity?: number | null
          created_at?: string | null
          customer_ontology?: number | null
          dominance_ontology?: number | null
          drive_ontology?: number | null
          entity_id: string
          entity_type?: string
          id?: number
          mechanism_score?: number | null
          mechanism_tokens_count?: number | null
          narrative_no_constraint_penalty?: number | null
          pythia_score: number
          reality_contact_score?: number | null
          reality_markers_count?: number | null
          snippet_count?: number | null
          source_count?: number | null
          sovereignty_ontology?: number | null
          temporal_span_days?: number | null
          tier1_pct?: number | null
          tier2_pct?: number | null
          tier3_pct?: number | null
          unfalsifiable_penalty?: number | null
          updated_at?: string | null
          wow_ontology?: number | null
        }
        Update: {
          action_verb_count?: number | null
          adjective_count?: number | null
          adjective_verb_penalty?: number | null
          computed_at?: string | null
          confidence?: number
          constraint_markers_count?: number | null
          constraint_score?: number | null
          context_diversity?: number | null
          created_at?: string | null
          customer_ontology?: number | null
          dominance_ontology?: number | null
          drive_ontology?: number | null
          entity_id?: string
          entity_type?: string
          id?: number
          mechanism_score?: number | null
          mechanism_tokens_count?: number | null
          narrative_no_constraint_penalty?: number | null
          pythia_score?: number
          reality_contact_score?: number | null
          reality_markers_count?: number | null
          snippet_count?: number | null
          source_count?: number | null
          sovereignty_ontology?: number | null
          temporal_span_days?: number | null
          tier1_pct?: number | null
          tier2_pct?: number | null
          tier3_pct?: number | null
          unfalsifiable_penalty?: number | null
          updated_at?: string | null
          wow_ontology?: number | null
        }
        Relationships: []
      }
      pythia_speech_snippets: {
        Row: {
          context_label: string | null
          created_at: string | null
          date_published: string | null
          entity_id: string
          entity_type: string
          id: number
          source_created_at_i: number | null
          source_item_id: string | null
          source_type: string
          source_url: string | null
          text: string
          text_hash: string | null
          tier: number
          updated_at: string | null
        }
        Insert: {
          context_label?: string | null
          created_at?: string | null
          date_published?: string | null
          entity_id: string
          entity_type?: string
          id?: number
          source_created_at_i?: number | null
          source_item_id?: string | null
          source_type: string
          source_url?: string | null
          text: string
          text_hash?: string | null
          tier: number
          updated_at?: string | null
        }
        Update: {
          context_label?: string | null
          created_at?: string | null
          date_published?: string | null
          entity_id?: string
          entity_type?: string
          id?: number
          source_created_at_i?: number | null
          source_item_id?: string | null
          source_type?: string
          source_url?: string | null
          text?: string
          text_hash?: string | null
          tier?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      recommendation_analytics: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          investor_id: string | null
          metadata: Json | null
          startup_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          investor_id?: string | null
          metadata?: Json | null
          startup_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          investor_id?: string | null
          metadata?: Json | null
          startup_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_analytics_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "recommendation_analytics_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "recommendation_analytics_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_analytics_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      role_inference_rules: {
        Row: {
          confidence: number
          created_at: string
          event_type: string
          examples: string[]
          frame_type: string
          id: string
          object_likely_type: string
          subject_likely_type: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          event_type: string
          examples: string[]
          frame_type: string
          id?: string
          object_likely_type: string
          subject_likely_type: string
        }
        Update: {
          confidence?: number
          created_at?: string
          event_type?: string
          examples?: string[]
          frame_type?: string
          id?: string
          object_likely_type?: string
          subject_likely_type?: string
        }
        Relationships: []
      }
      rss_articles: {
        Row: {
          ai_analyzed: boolean | null
          ai_summary: string | null
          author: string | null
          categories: string[] | null
          companies_mentioned: string[] | null
          content: string | null
          created_at: string | null
          funding_amounts: string[] | null
          id: string
          investors_mentioned: string[] | null
          published_at: string | null
          scraped_at: string | null
          source: string
          source_id: string | null
          summary: string | null
          title: string
          updated_at: string | null
          url: string
        }
        Insert: {
          ai_analyzed?: boolean | null
          ai_summary?: string | null
          author?: string | null
          categories?: string[] | null
          companies_mentioned?: string[] | null
          content?: string | null
          created_at?: string | null
          funding_amounts?: string[] | null
          id?: string
          investors_mentioned?: string[] | null
          published_at?: string | null
          scraped_at?: string | null
          source: string
          source_id?: string | null
          summary?: string | null
          title: string
          updated_at?: string | null
          url: string
        }
        Update: {
          ai_analyzed?: boolean | null
          ai_summary?: string | null
          author?: string | null
          categories?: string[] | null
          companies_mentioned?: string[] | null
          content?: string | null
          created_at?: string | null
          funding_amounts?: string[] | null
          id?: string
          investors_mentioned?: string[] | null
          published_at?: string | null
          scraped_at?: string | null
          source?: string
          source_id?: string | null
          summary?: string | null
          title?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "rss_articles_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "rss_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      rss_sources: {
        Row: {
          active: boolean | null
          auth_password: string | null
          auth_username: string | null
          category: string
          created_at: string | null
          id: string
          last_scraped: string | null
          name: string
          requires_auth: boolean | null
          updated_at: string | null
          url: string
        }
        Insert: {
          active?: boolean | null
          auth_password?: string | null
          auth_username?: string | null
          category?: string
          created_at?: string | null
          id?: string
          last_scraped?: string | null
          name: string
          requires_auth?: boolean | null
          updated_at?: string | null
          url: string
        }
        Update: {
          active?: boolean | null
          auth_password?: string | null
          auth_username?: string | null
          category?: string
          created_at?: string | null
          id?: string
          last_scraped?: string | null
          name?: string
          requires_auth?: boolean | null
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      saved_matches: {
        Row: {
          id: string
          investor_id: string
          match_score: number | null
          notes: string | null
          saved_at: string | null
          startup_id: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          investor_id: string
          match_score?: number | null
          notes?: string | null
          saved_at?: string | null
          startup_id: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          investor_id?: string
          match_score?: number | null
          notes?: string | null
          saved_at?: string | null
          startup_id?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      score_history: {
        Row: {
          change_reason: string | null
          created_at: string | null
          id: string
          new_score: number | null
          old_score: number | null
          startup_id: string | null
        }
        Insert: {
          change_reason?: string | null
          created_at?: string | null
          id?: string
          new_score?: number | null
          old_score?: number | null
          startup_id?: string | null
        }
        Update: {
          change_reason?: string | null
          created_at?: string | null
          id?: string
          new_score?: number | null
          old_score?: number | null
          startup_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "score_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "score_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "score_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "score_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "score_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      scraper_jobs: {
        Row: {
          companies_enriched: number | null
          companies_found: number | null
          companies_uploaded: number | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          source_id: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          companies_enriched?: number | null
          companies_found?: number | null
          companies_uploaded?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          source_id?: string | null
          started_at?: string | null
          status: string
        }
        Update: {
          companies_enriched?: number | null
          companies_found?: number | null
          companies_uploaded?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          source_id?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scraper_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "scraper_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scraper_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources_needing_refresh"
            referencedColumns: ["id"]
          },
        ]
      }
      scraper_logs: {
        Row: {
          created_at: string | null
          id: string
          job_id: string | null
          level: string
          message: string
          metadata: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id?: string | null
          level: string
          message: string
          metadata?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string | null
          level?: string
          message?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "scraper_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scraper_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      scraper_results: {
        Row: {
          company_name: string
          company_url: string
          created_at: string | null
          enriched_data: Json | null
          entity_type: string | null
          error_message: string | null
          id: string
          job_id: string | null
          source_id: string | null
          startup_id: string | null
          status: string
          uploaded_at: string | null
        }
        Insert: {
          company_name: string
          company_url: string
          created_at?: string | null
          enriched_data?: Json | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          job_id?: string | null
          source_id?: string | null
          startup_id?: string | null
          status: string
          uploaded_at?: string | null
        }
        Update: {
          company_name?: string
          company_url?: string
          created_at?: string | null
          enriched_data?: Json | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          job_id?: string | null
          source_id?: string | null
          startup_id?: string | null
          status?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scraper_results_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scraper_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scraper_results_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "scraper_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scraper_results_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources_needing_refresh"
            referencedColumns: ["id"]
          },
        ]
      }
      scraper_selectors: {
        Row: {
          active: boolean | null
          created_at: string | null
          data_type: string
          domain: string
          failure_count: number | null
          field: string | null
          id: string
          last_failure: string | null
          last_success: string | null
          metadata: Json | null
          selector: string
          strategy: string
          success_rate: number | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          data_type: string
          domain: string
          failure_count?: number | null
          field?: string | null
          id?: string
          last_failure?: string | null
          last_success?: string | null
          metadata?: Json | null
          selector: string
          strategy?: string
          success_rate?: number | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          data_type?: string
          domain?: string
          failure_count?: number | null
          field?: string | null
          id?: string
          last_failure?: string | null
          last_success?: string | null
          metadata?: Json | null
          selector?: string
          strategy?: string
          success_rate?: number | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      scraper_sources: {
        Row: {
          auto_refresh: boolean | null
          company_count: number | null
          created_at: string | null
          css_selector: string | null
          id: string
          is_active: boolean | null
          last_scraped_at: string | null
          name: string
          refresh_schedule: string | null
          success_rate: number | null
          type: string
          updated_at: string | null
          url: string
        }
        Insert: {
          auto_refresh?: boolean | null
          company_count?: number | null
          created_at?: string | null
          css_selector?: string | null
          id?: string
          is_active?: boolean | null
          last_scraped_at?: string | null
          name: string
          refresh_schedule?: string | null
          success_rate?: number | null
          type: string
          updated_at?: string | null
          url: string
        }
        Update: {
          auto_refresh?: boolean | null
          company_count?: number | null
          created_at?: string | null
          css_selector?: string | null
          id?: string
          is_active?: boolean | null
          last_scraped_at?: string | null
          name?: string
          refresh_schedule?: string | null
          success_rate?: number | null
          type?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      sector_benchmarks: {
        Row: {
          avg_funded_god_score: number | null
          avg_raise_amount: number | null
          avg_time_to_funding_months: number | null
          competition_level: string | null
          historical_funding_rate: number | null
          id: string
          investor_demand_score: number | null
          last_updated: string | null
          market_velocity: string | null
          sector: string
        }
        Insert: {
          avg_funded_god_score?: number | null
          avg_raise_amount?: number | null
          avg_time_to_funding_months?: number | null
          competition_level?: string | null
          historical_funding_rate?: number | null
          id?: string
          investor_demand_score?: number | null
          last_updated?: string | null
          market_velocity?: string | null
          sector: string
        }
        Update: {
          avg_funded_god_score?: number | null
          avg_raise_amount?: number | null
          avg_time_to_funding_months?: number | null
          competition_level?: string | null
          historical_funding_rate?: number | null
          id?: string
          investor_demand_score?: number | null
          last_updated?: string | null
          market_velocity?: string | null
          sector?: string
        }
        Relationships: []
      }
      sent_notifications: {
        Row: {
          content_summary: string | null
          email: string | null
          id: string
          notification_type: string
          sent_at: string | null
          startup_id: string | null
          subject: string | null
        }
        Insert: {
          content_summary?: string | null
          email?: string | null
          id?: string
          notification_type: string
          sent_at?: string | null
          startup_id?: string | null
          subject?: string | null
        }
        Update: {
          content_summary?: string | null
          email?: string | null
          id?: string
          notification_type?: string
          sent_at?: string | null
          startup_id?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      service_results: {
        Row: {
          created_at: string | null
          expires_at: string | null
          generated_at: string | null
          id: string
          input_data: Json | null
          output_data: Json | null
          service_slug: string
          startup_id: string
          status: string | null
          template_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          service_slug: string
          startup_id: string
          status?: string | null
          template_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          service_slug?: string
          startup_id?: string
          status?: string | null
          template_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_results_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "service_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      service_templates: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          estimated_time: string | null
          fields_required: Json | null
          god_score_impact: string[] | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          output_format: Json | null
          prompt_template: string | null
          slug: string
          sort_order: number | null
          step_number: number | null
          tier_required: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          estimated_time?: string | null
          fields_required?: Json | null
          god_score_impact?: string[] | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          output_format?: Json | null
          prompt_template?: string | null
          slug: string
          sort_order?: number | null
          step_number?: number | null
          tier_required?: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          estimated_time?: string | null
          fields_required?: Json | null
          god_score_impact?: string[] | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          output_format?: Json | null
          prompt_template?: string | null
          slug?: string
          sort_order?: number | null
          step_number?: number | null
          tier_required?: string
        }
        Relationships: []
      }
      signal_trends: {
        Row: {
          avg_sentiment: number | null
          created_at: string | null
          id: string
          mention_count: number | null
          period_end: string
          period_start: string
          sector: string | null
          theme: string | null
        }
        Insert: {
          avg_sentiment?: number | null
          created_at?: string | null
          id?: string
          mention_count?: number | null
          period_end: string
          period_start: string
          sector?: string | null
          theme?: string | null
        }
        Update: {
          avg_sentiment?: number | null
          created_at?: string | null
          id?: string
          mention_count?: number | null
          period_end?: string
          period_start?: string
          sector?: string | null
          theme?: string | null
        }
        Relationships: []
      }
      signal_types: {
        Row: {
          default_reversibility: string | null
          description: string | null
          is_structure_bearing: boolean | null
          is_velocity_bearing: boolean | null
          key: string
          label: string
        }
        Insert: {
          default_reversibility?: string | null
          description?: string | null
          is_structure_bearing?: boolean | null
          is_velocity_bearing?: boolean | null
          key: string
          label: string
        }
        Update: {
          default_reversibility?: string | null
          description?: string | null
          is_structure_bearing?: boolean | null
          is_velocity_bearing?: boolean | null
          key?: string
          label?: string
        }
        Relationships: []
      }
      signals: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          published_at: string | null
          sectors: Json | null
          sentiment: string | null
          signal_strength: number | null
          source_name: string
          source_type: string
          source_url: string | null
          themes: Json | null
          title: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          published_at?: string | null
          sectors?: Json | null
          sentiment?: string | null
          signal_strength?: number | null
          source_name: string
          source_type: string
          source_url?: string | null
          themes?: Json | null
          title?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          published_at?: string | null
          sectors?: Json | null
          sentiment?: string | null
          signal_strength?: number | null
          source_name?: string
          source_type?: string
          source_url?: string | null
          themes?: Json | null
          title?: string | null
        }
        Relationships: []
      }
      social_signals: {
        Row: {
          author: string | null
          collected_at: string | null
          content: string | null
          created_at: string | null
          engagement_score: number | null
          id: number
          platform: string
          reputation_score: number | null
          sentiment: string | null
          signal_type: string | null
          source_url: string | null
          startup_id: string | null
          startup_name: string | null
        }
        Insert: {
          author?: string | null
          collected_at?: string | null
          content?: string | null
          created_at?: string | null
          engagement_score?: number | null
          id?: number
          platform: string
          reputation_score?: number | null
          sentiment?: string | null
          signal_type?: string | null
          source_url?: string | null
          startup_id?: string | null
          startup_name?: string | null
        }
        Update: {
          author?: string | null
          collected_at?: string | null
          content?: string | null
          created_at?: string | null
          engagement_score?: number | null
          id?: number
          platform?: string
          reputation_score?: number | null
          sentiment?: string | null
          signal_type?: string | null
          source_url?: string | null
          startup_id?: string | null
          startup_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "social_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "social_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "social_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "social_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      solution_patterns: {
        Row: {
          created_at: string | null
          effectiveness_score: number | null
          example_companies: string[] | null
          id: string
          key_features: string[] | null
          problem_id: string | null
          solution_description: string | null
          solution_type: string
        }
        Insert: {
          created_at?: string | null
          effectiveness_score?: number | null
          example_companies?: string[] | null
          id?: string
          key_features?: string[] | null
          problem_id?: string | null
          solution_description?: string | null
          solution_type: string
        }
        Update: {
          created_at?: string | null
          effectiveness_score?: number | null
          example_companies?: string[] | null
          id?: string
          key_features?: string[] | null
          problem_id?: string | null
          solution_description?: string | null
          solution_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "solution_patterns_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "market_problems"
            referencedColumns: ["id"]
          },
        ]
      }
      sourcing_fees: {
        Row: {
          attributed_to_match_id: string | null
          attributed_to_recommendation_id: string | null
          created_at: string | null
          deal_close_date: string | null
          deal_id: string
          fee_amount: number
          fee_percentage: number | null
          fee_status: string | null
          id: string
          investment_amount: number
          investor_id: string | null
          invoice_date: string | null
          invoice_id: string | null
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          round_type: string | null
          startup_id: string | null
          startup_name: string
          updated_at: string | null
        }
        Insert: {
          attributed_to_match_id?: string | null
          attributed_to_recommendation_id?: string | null
          created_at?: string | null
          deal_close_date?: string | null
          deal_id: string
          fee_amount: number
          fee_percentage?: number | null
          fee_status?: string | null
          id?: string
          investment_amount: number
          investor_id?: string | null
          invoice_date?: string | null
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          round_type?: string | null
          startup_id?: string | null
          startup_name: string
          updated_at?: string | null
        }
        Update: {
          attributed_to_match_id?: string | null
          attributed_to_recommendation_id?: string | null
          created_at?: string | null
          deal_close_date?: string | null
          deal_id?: string
          fee_amount?: number
          fee_percentage?: number | null
          fee_status?: string | null
          id?: string
          investment_amount?: number
          investor_id?: string | null
          invoice_date?: string | null
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          round_type?: string | null
          startup_id?: string | null
          startup_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sourcing_fees_attributed_to_recommendation_id_fkey"
            columns: ["attributed_to_recommendation_id"]
            isOneToOne: false
            referencedRelation: "startup_recommendations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sourcing_fees_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "sourcing_fees_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "sourcing_fees_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sourcing_fees_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_alert_state: {
        Row: {
          last_evidence_signal: number | null
          last_investor_state_sector: string | null
          last_momentum_signal: number | null
          startup_id: string
          updated_at: string | null
        }
        Insert: {
          last_evidence_signal?: number | null
          last_investor_state_sector?: string | null
          last_momentum_signal?: number | null
          startup_id: string
          updated_at?: string | null
        }
        Update: {
          last_evidence_signal?: number | null
          last_investor_state_sector?: string | null
          last_momentum_signal?: number | null
          startup_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      startup_capital_signals: {
        Row: {
          amount_usd: number | null
          announced_at: string | null
          created_at: string
          detected_at: string
          evidence: Json
          fingerprint: string | null
          id: string
          investor_tier: number
          is_conviction: boolean
          lead_investor_domain: string | null
          lead_investor_name: string | null
          round_type: string | null
          signal_type: string
          source_url: string | null
          startup_id: string
          valuation_usd: number | null
        }
        Insert: {
          amount_usd?: number | null
          announced_at?: string | null
          created_at?: string
          detected_at?: string
          evidence?: Json
          fingerprint?: string | null
          id?: string
          investor_tier?: number
          is_conviction?: boolean
          lead_investor_domain?: string | null
          lead_investor_name?: string | null
          round_type?: string | null
          signal_type: string
          source_url?: string | null
          startup_id: string
          valuation_usd?: number | null
        }
        Update: {
          amount_usd?: number | null
          announced_at?: string | null
          created_at?: string
          detected_at?: string
          evidence?: Json
          fingerprint?: string | null
          id?: string
          investor_tier?: number
          is_conviction?: boolean
          lead_investor_domain?: string | null
          lead_investor_name?: string | null
          round_type?: string | null
          signal_type?: string
          source_url?: string | null
          startup_id?: string
          valuation_usd?: number | null
        }
        Relationships: []
      }
      startup_customer_proof_signals: {
        Row: {
          created_at: string
          customer_domain: string | null
          customer_name: string | null
          customer_tier: number
          detected_at: string
          evidence: Json
          fingerprint: string | null
          id: string
          page_url: string | null
          signal_type: string
          startup_id: string
        }
        Insert: {
          created_at?: string
          customer_domain?: string | null
          customer_name?: string | null
          customer_tier?: number
          detected_at?: string
          evidence?: Json
          fingerprint?: string | null
          id?: string
          page_url?: string | null
          signal_type: string
          startup_id: string
        }
        Update: {
          created_at?: string
          customer_domain?: string | null
          customer_name?: string | null
          customer_tier?: number
          detected_at?: string
          evidence?: Json
          fingerprint?: string | null
          id?: string
          page_url?: string | null
          signal_type?: string
          startup_id?: string
        }
        Relationships: []
      }
      startup_event_entities: {
        Row: {
          confidence: number
          entity_name: string
          event_id: string
          role: string
          source: string
        }
        Insert: {
          confidence: number
          entity_name: string
          event_id: string
          role: string
          source: string
        }
        Update: {
          confidence?: number
          entity_name?: string
          event_id?: string
          role?: string
          source?: string
        }
        Relationships: []
      }
      startup_events: {
        Row: {
          amounts: Json | null
          created_at: string
          entities: Json
          event_id: string
          event_type: string
          extraction_meta: Json
          frame_confidence: number
          frame_type: string
          id: string
          notes: Json | null
          object: string | null
          occurred_at: string
          round: string | null
          semantic_context: Json | null
          source_published_at: string | null
          source_publisher: string
          source_title: string
          source_url: string
          subject: string | null
          verb: string | null
        }
        Insert: {
          amounts?: Json | null
          created_at?: string
          entities?: Json
          event_id: string
          event_type: string
          extraction_meta: Json
          frame_confidence: number
          frame_type: string
          id?: string
          notes?: Json | null
          object?: string | null
          occurred_at: string
          round?: string | null
          semantic_context?: Json | null
          source_published_at?: string | null
          source_publisher: string
          source_title: string
          source_url: string
          subject?: string | null
          verb?: string | null
        }
        Update: {
          amounts?: Json | null
          created_at?: string
          entities?: Json
          event_id?: string
          event_type?: string
          extraction_meta?: Json
          frame_confidence?: number
          frame_type?: string
          id?: string
          notes?: Json | null
          object?: string | null
          occurred_at?: string
          round?: string | null
          semantic_context?: Json | null
          source_published_at?: string | null
          source_publisher?: string
          source_title?: string
          source_url?: string
          subject?: string | null
          verb?: string | null
        }
        Relationships: []
      }
      startup_exits: {
        Row: {
          acquirer_name: string | null
          acquirer_type: string | null
          created_at: string | null
          currency: string | null
          deal_status: string | null
          discovered_at: string | null
          exchange: string | null
          exit_date: string | null
          exit_notes: string | null
          exit_type: string
          exit_value: string | null
          exit_value_numeric: number | null
          id: string
          investors_involved: string[] | null
          ipo_price: number | null
          key_factors: string[] | null
          lead_investor_id: string | null
          market_cap_at_ipo: number | null
          source_date: string | null
          source_title: string | null
          source_url: string | null
          startup_id: string | null
          startup_name: string
          ticker_symbol: string | null
          transaction_structure: string | null
          updated_at: string | null
          valuation_multiple: number | null
          verification_notes: string | null
          verified: boolean | null
        }
        Insert: {
          acquirer_name?: string | null
          acquirer_type?: string | null
          created_at?: string | null
          currency?: string | null
          deal_status?: string | null
          discovered_at?: string | null
          exchange?: string | null
          exit_date?: string | null
          exit_notes?: string | null
          exit_type: string
          exit_value?: string | null
          exit_value_numeric?: number | null
          id?: string
          investors_involved?: string[] | null
          ipo_price?: number | null
          key_factors?: string[] | null
          lead_investor_id?: string | null
          market_cap_at_ipo?: number | null
          source_date?: string | null
          source_title?: string | null
          source_url?: string | null
          startup_id?: string | null
          startup_name: string
          ticker_symbol?: string | null
          transaction_structure?: string | null
          updated_at?: string | null
          valuation_multiple?: number | null
          verification_notes?: string | null
          verified?: boolean | null
        }
        Update: {
          acquirer_name?: string | null
          acquirer_type?: string | null
          created_at?: string | null
          currency?: string | null
          deal_status?: string | null
          discovered_at?: string | null
          exchange?: string | null
          exit_date?: string | null
          exit_notes?: string | null
          exit_type?: string
          exit_value?: string | null
          exit_value_numeric?: number | null
          id?: string
          investors_involved?: string[] | null
          ipo_price?: number | null
          key_factors?: string[] | null
          lead_investor_id?: string | null
          market_cap_at_ipo?: number | null
          source_date?: string | null
          source_title?: string | null
          source_url?: string | null
          startup_id?: string | null
          startup_name?: string
          ticker_symbol?: string | null
          transaction_structure?: string | null
          updated_at?: string | null
          valuation_multiple?: number | null
          verification_notes?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "startup_exits_lead_investor_id_fkey"
            columns: ["lead_investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "startup_exits_lead_investor_id_fkey"
            columns: ["lead_investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "startup_exits_lead_investor_id_fkey"
            columns: ["lead_investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_exits_lead_investor_id_fkey"
            columns: ["lead_investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_exits_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "startup_exits_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "startup_exits_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "startup_exits_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_exits_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_exits_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_exits_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_exits_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_exits_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_exits_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_exits_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_exits_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_exits_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_exits_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "startup_exits_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_exits_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_exits_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_feedback: {
        Row: {
          comment: string | null
          created_at: string | null
          feedback_type: string
          id: string
          metadata: Json | null
          rating: number | null
          startup_id: string
          updated_at: string | null
          user_id: string
          vote: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          feedback_type: string
          id?: string
          metadata?: Json | null
          rating?: number | null
          startup_id: string
          updated_at?: string | null
          user_id: string
          vote?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          feedback_type?: string
          id?: string
          metadata?: Json | null
          rating?: number | null
          startup_id?: string
          updated_at?: string | null
          user_id?: string
          vote?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "startup_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "startup_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "startup_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "startup_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "startup_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_feedback_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_fomo_emit_gate: {
        Row: {
          last_emitted_at: string
          startup_id: string
        }
        Insert: {
          last_emitted_at?: string
          startup_id: string
        }
        Update: {
          last_emitted_at?: string
          startup_id?: string
        }
        Relationships: []
      }
      startup_fomo_events: {
        Row: {
          fomo_ratio: number
          from_level: number
          from_state: string
          id: number
          occurred_at: string
          occurred_date: string
          signal_24h: number
          startup_id: string
          tier_breakdown: Json
          to_level: number
          to_state: string
        }
        Insert: {
          fomo_ratio: number
          from_level: number
          from_state: string
          id?: number
          occurred_at?: string
          occurred_date?: string
          signal_24h: number
          startup_id: string
          tier_breakdown?: Json
          to_level: number
          to_state: string
        }
        Update: {
          fomo_ratio?: number
          from_level?: number
          from_state?: string
          id?: number
          occurred_at?: string
          occurred_date?: string
          signal_24h?: number
          startup_id?: string
          tier_breakdown?: Json
          to_level?: number
          to_state?: string
        }
        Relationships: []
      }
      startup_fomo_snapshots: {
        Row: {
          avg_events_per_day_7d: number
          avg_signal_per_day_7d: number
          delta_events_24h: number
          delta_signal_24h: number
          events_24h: number
          events_7d: number
          events_prev_24h: number
          fomo_level: number
          fomo_ratio: number
          fomo_state: string
          id: number
          notes: Json
          signal_24h: number
          signal_7d: number
          signal_prev_24h: number
          snapshot_at: string
          snapshot_date: string
          startup_id: string
        }
        Insert: {
          avg_events_per_day_7d: number
          avg_signal_per_day_7d: number
          delta_events_24h: number
          delta_signal_24h: number
          events_24h: number
          events_7d: number
          events_prev_24h: number
          fomo_level: number
          fomo_ratio: number
          fomo_state: string
          id?: number
          notes?: Json
          signal_24h: number
          signal_7d: number
          signal_prev_24h: number
          snapshot_at?: string
          snapshot_date?: string
          startup_id: string
        }
        Update: {
          avg_events_per_day_7d?: number
          avg_signal_per_day_7d?: number
          delta_events_24h?: number
          delta_signal_24h?: number
          events_24h?: number
          events_7d?: number
          events_prev_24h?: number
          fomo_level?: number
          fomo_ratio?: number
          fomo_state?: string
          id?: number
          notes?: Json
          signal_24h?: number
          signal_7d?: number
          signal_prev_24h?: number
          snapshot_at?: string
          snapshot_date?: string
          startup_id?: string
        }
        Relationships: []
      }
      startup_fomo_trigger_events: {
        Row: {
          events_24h: number | null
          events_7d: number | null
          fomo_ratio: number | null
          fomo_state: string
          id: string
          signal_24h: number | null
          signal_7d: number | null
          signal_delta_24h: number | null
          startup_id: string
          triggered_at: string
        }
        Insert: {
          events_24h?: number | null
          events_7d?: number | null
          fomo_ratio?: number | null
          fomo_state: string
          id?: string
          signal_24h?: number | null
          signal_7d?: number | null
          signal_delta_24h?: number | null
          startup_id: string
          triggered_at?: string
        }
        Update: {
          events_24h?: number | null
          events_7d?: number | null
          fomo_ratio?: number | null
          fomo_state?: string
          id?: string
          signal_24h?: number | null
          signal_7d?: number | null
          signal_delta_24h?: number | null
          startup_id?: string
          triggered_at?: string
        }
        Relationships: []
      }
      startup_god_scores: {
        Row: {
          computed_at: string
          d_determination: number
          drivers: Json
          fomo_boost: number
          g_grit: number
          god_score: number
          o_opportunity: number
          startup_id: string
          updated_at: string | null
        }
        Insert: {
          computed_at?: string
          d_determination?: number
          drivers?: Json
          fomo_boost?: number
          g_grit?: number
          god_score?: number
          o_opportunity?: number
          startup_id: string
          updated_at?: string | null
        }
        Update: {
          computed_at?: string
          d_determination?: number
          drivers?: Json
          fomo_boost?: number
          g_grit?: number
          god_score?: number
          o_opportunity?: number
          startup_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      startup_goldilocks_state_history: {
        Row: {
          avg_coupling_7d: number
          avg_irrev_7d: number
          created_at: string
          domains_7d: number
          goldilocks_phase_state: string
          id: string
          last_domain: string | null
          last_occurred_at: string | null
          last_subtype: string | null
          pcm: number
          pvi_24h: number
          pvi_7d: number
          pvi_accel_ratio: number
          snapshot_date: string
          startup_id: string
        }
        Insert: {
          avg_coupling_7d?: number
          avg_irrev_7d?: number
          created_at?: string
          domains_7d?: number
          goldilocks_phase_state: string
          id?: string
          last_domain?: string | null
          last_occurred_at?: string | null
          last_subtype?: string | null
          pcm?: number
          pvi_24h?: number
          pvi_7d?: number
          pvi_accel_ratio?: number
          snapshot_date?: string
          startup_id: string
        }
        Update: {
          avg_coupling_7d?: number
          avg_irrev_7d?: number
          created_at?: string
          domains_7d?: number
          goldilocks_phase_state?: string
          id?: string
          last_domain?: string | null
          last_occurred_at?: string | null
          last_subtype?: string | null
          pcm?: number
          pvi_24h?: number
          pvi_7d?: number
          pvi_accel_ratio?: number
          snapshot_date?: string
          startup_id?: string
        }
        Relationships: []
      }
      startup_human_signals: {
        Row: {
          created_at: string
          credibility_tier: number
          detected_at: string
          engagement_hint: string | null
          evidence: Json
          fingerprint: string | null
          id: string
          person_name: string
          person_profile_url: string | null
          role: string | null
          signal_type: string
          startup_id: string
        }
        Insert: {
          created_at?: string
          credibility_tier?: number
          detected_at?: string
          engagement_hint?: string | null
          evidence?: Json
          fingerprint?: string | null
          id?: string
          person_name: string
          person_profile_url?: string | null
          role?: string | null
          signal_type: string
          startup_id: string
        }
        Update: {
          created_at?: string
          credibility_tier?: number
          detected_at?: string
          engagement_hint?: string | null
          evidence?: Json
          fingerprint?: string | null
          id?: string
          person_name?: string
          person_profile_url?: string | null
          role?: string | null
          signal_type?: string
          startup_id?: string
        }
        Relationships: []
      }
      startup_investor_matches: {
        Row: {
          algorithm_version: string | null
          confidence_level: string | null
          contacted_at: string | null
          created_at: string | null
          created_by: string | null
          feedback_received: boolean | null
          fit_analysis: Json | null
          id: string
          intro_email_body: string | null
          intro_email_subject: string | null
          intro_requested_at: string | null
          investor_id: string
          last_interaction: string | null
          match_score: number | null
          reasoning: string | null
          similarity_score: number | null
          startup_id: string
          status: string | null
          success_score: number | null
          updated_at: string | null
          user_id: string | null
          viewed_at: string | null
          why_you_match: string[] | null
        }
        Insert: {
          algorithm_version?: string | null
          confidence_level?: string | null
          contacted_at?: string | null
          created_at?: string | null
          created_by?: string | null
          feedback_received?: boolean | null
          fit_analysis?: Json | null
          id?: string
          intro_email_body?: string | null
          intro_email_subject?: string | null
          intro_requested_at?: string | null
          investor_id: string
          last_interaction?: string | null
          match_score?: number | null
          reasoning?: string | null
          similarity_score?: number | null
          startup_id: string
          status?: string | null
          success_score?: number | null
          updated_at?: string | null
          user_id?: string | null
          viewed_at?: string | null
          why_you_match?: string[] | null
        }
        Update: {
          algorithm_version?: string | null
          confidence_level?: string | null
          contacted_at?: string | null
          created_at?: string | null
          created_by?: string | null
          feedback_received?: boolean | null
          fit_analysis?: Json | null
          id?: string
          intro_email_body?: string | null
          intro_email_subject?: string | null
          intro_requested_at?: string | null
          investor_id?: string
          last_interaction?: string | null
          match_score?: number | null
          reasoning?: string | null
          similarity_score?: number | null
          startup_id?: string
          status?: string | null
          success_score?: number | null
          updated_at?: string | null
          user_id?: string | null
          viewed_at?: string | null
          why_you_match?: string[] | null
        }
        Relationships: []
      }
      startup_jobs: {
        Row: {
          created_at: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          match_count: number | null
          progress_percent: number | null
          started_at: string | null
          startup_id: string | null
          status: string
          updated_at: string | null
          url: string
          url_normalized: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          match_count?: number | null
          progress_percent?: number | null
          started_at?: string | null
          startup_id?: string | null
          status: string
          updated_at?: string | null
          url: string
          url_normalized: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          match_count?: number | null
          progress_percent?: number | null
          started_at?: string | null
          startup_id?: string | null
          status?: string
          updated_at?: string | null
          url?: string
          url_normalized?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_jobs_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "startup_jobs_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "startup_jobs_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "startup_jobs_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_jobs_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_jobs_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_jobs_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_jobs_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_jobs_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_jobs_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_jobs_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_jobs_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_jobs_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_jobs_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "startup_jobs_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_jobs_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_jobs_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_market_event_links: {
        Row: {
          created_at: string
          detected_at: string
          fingerprint: string | null
          id: string
          link_evidence: Json
          market_event_id: string
          relevance: number
          startup_id: string
        }
        Insert: {
          created_at?: string
          detected_at?: string
          fingerprint?: string | null
          id?: string
          link_evidence?: Json
          market_event_id: string
          relevance?: number
          startup_id: string
        }
        Update: {
          created_at?: string
          detected_at?: string
          fingerprint?: string | null
          id?: string
          link_evidence?: Json
          market_event_id?: string
          relevance?: number
          startup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_market_event_links_market_event_id_fkey"
            columns: ["market_event_id"]
            isOneToOne: false
            referencedRelation: "market_auto_link_preview"
            referencedColumns: ["market_event_id"]
          },
          {
            foreignKeyName: "startup_market_event_links_market_event_id_fkey"
            columns: ["market_event_id"]
            isOneToOne: false
            referencedRelation: "market_events"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_phase_changes: {
        Row: {
          confidence: number
          coupling: number
          created_at: string
          detected_at: string
          directionality: number
          domain: Database["public"]["Enums"]["phase_domain"]
          effective_at: string | null
          evidence: Json
          fingerprint: string | null
          id: string
          irreversibility: number
          is_active: boolean
          magnitude: number
          startup_id: string
          subtype: string
          updated_at: string
          velocity: number
        }
        Insert: {
          confidence?: number
          coupling?: number
          created_at?: string
          detected_at?: string
          directionality?: number
          domain: Database["public"]["Enums"]["phase_domain"]
          effective_at?: string | null
          evidence?: Json
          fingerprint?: string | null
          id?: string
          irreversibility?: number
          is_active?: boolean
          magnitude?: number
          startup_id: string
          subtype: string
          updated_at?: string
          velocity?: number
        }
        Update: {
          confidence?: number
          coupling?: number
          created_at?: string
          detected_at?: string
          directionality?: number
          domain?: Database["public"]["Enums"]["phase_domain"]
          effective_at?: string | null
          evidence?: Json
          fingerprint?: string | null
          id?: string
          irreversibility?: number
          is_active?: boolean
          magnitude?: number
          startup_id?: string
          subtype?: string
          updated_at?: string
          velocity?: number
        }
        Relationships: []
      }
      startup_recommendations: {
        Row: {
          approach_strategy: string | null
          avoid_topics: string[] | null
          best_contact_timing: string | null
          competitive_concerns: string[] | null
          created_at: string | null
          fit_score: number | null
          followup_email_body: string | null
          id: string
          intro_email_body: string | null
          intro_email_subject: string | null
          investor_id: string | null
          notes: string | null
          outreach_date: string | null
          partner_specific_notes: string | null
          portfolio_synergies: string[] | null
          recent_activity_signals: Json | null
          recommended_intro_path: Json | null
          response_date: string | null
          startup_id: string
          status: string | null
          talking_points: string[] | null
          thesis_alignment: string | null
          timing_rationale: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          approach_strategy?: string | null
          avoid_topics?: string[] | null
          best_contact_timing?: string | null
          competitive_concerns?: string[] | null
          created_at?: string | null
          fit_score?: number | null
          followup_email_body?: string | null
          id?: string
          intro_email_body?: string | null
          intro_email_subject?: string | null
          investor_id?: string | null
          notes?: string | null
          outreach_date?: string | null
          partner_specific_notes?: string | null
          portfolio_synergies?: string[] | null
          recent_activity_signals?: Json | null
          recommended_intro_path?: Json | null
          response_date?: string | null
          startup_id: string
          status?: string | null
          talking_points?: string[] | null
          thesis_alignment?: string | null
          timing_rationale?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          approach_strategy?: string | null
          avoid_topics?: string[] | null
          best_contact_timing?: string | null
          competitive_concerns?: string[] | null
          created_at?: string | null
          fit_score?: number | null
          followup_email_body?: string | null
          id?: string
          intro_email_body?: string | null
          intro_email_subject?: string | null
          investor_id?: string | null
          notes?: string | null
          outreach_date?: string | null
          partner_specific_notes?: string | null
          portfolio_synergies?: string[] | null
          recent_activity_signals?: Json | null
          recommended_intro_path?: Json | null
          response_date?: string | null
          startup_id?: string
          status?: string | null
          talking_points?: string[] | null
          thesis_alignment?: string | null
          timing_rationale?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_recommendations_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "startup_recommendations_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "startup_recommendations_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_recommendations_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_signal_deltas: {
        Row: {
          alignment_delta: number | null
          alignment_from: number | null
          alignment_to: number | null
          band_changed: boolean | null
          band_from: string | null
          band_to: string | null
          compared_at: string | null
          created_at: string | null
          days_elapsed: number | null
          from_date: string | null
          id: string
          investors_gained: string[] | null
          investors_gained_count: number | null
          investors_lost: string[] | null
          investors_lost_count: number | null
          investors_stable_count: number | null
          match_count_delta: number | null
          match_count_from: number | null
          match_count_to: number | null
          narrative: string | null
          phase_delta: number | null
          phase_delta_percent: number | null
          signal_strength_delta: number | null
          snapshot_from_id: string | null
          snapshot_to_id: string | null
          startup_id: string
          summary_emoji: string | null
          to_date: string | null
        }
        Insert: {
          alignment_delta?: number | null
          alignment_from?: number | null
          alignment_to?: number | null
          band_changed?: boolean | null
          band_from?: string | null
          band_to?: string | null
          compared_at?: string | null
          created_at?: string | null
          days_elapsed?: number | null
          from_date?: string | null
          id?: string
          investors_gained?: string[] | null
          investors_gained_count?: number | null
          investors_lost?: string[] | null
          investors_lost_count?: number | null
          investors_stable_count?: number | null
          match_count_delta?: number | null
          match_count_from?: number | null
          match_count_to?: number | null
          narrative?: string | null
          phase_delta?: number | null
          phase_delta_percent?: number | null
          signal_strength_delta?: number | null
          snapshot_from_id?: string | null
          snapshot_to_id?: string | null
          startup_id: string
          summary_emoji?: string | null
          to_date?: string | null
        }
        Update: {
          alignment_delta?: number | null
          alignment_from?: number | null
          alignment_to?: number | null
          band_changed?: boolean | null
          band_from?: string | null
          band_to?: string | null
          compared_at?: string | null
          created_at?: string | null
          days_elapsed?: number | null
          from_date?: string | null
          id?: string
          investors_gained?: string[] | null
          investors_gained_count?: number | null
          investors_lost?: string[] | null
          investors_lost_count?: number | null
          investors_stable_count?: number | null
          match_count_delta?: number | null
          match_count_from?: number | null
          match_count_to?: number | null
          narrative?: string | null
          phase_delta?: number | null
          phase_delta_percent?: number | null
          signal_strength_delta?: number | null
          snapshot_from_id?: string | null
          snapshot_to_id?: string | null
          startup_id?: string
          summary_emoji?: string | null
          to_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "startup_signal_deltas_snapshot_from_id_fkey"
            columns: ["snapshot_from_id"]
            isOneToOne: false
            referencedRelation: "startup_signal_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_deltas_snapshot_to_id_fkey"
            columns: ["snapshot_to_id"]
            isOneToOne: false
            referencedRelation: "startup_signal_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_deltas_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "startup_signal_deltas_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "startup_signal_deltas_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "startup_signal_deltas_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_deltas_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_deltas_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_deltas_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_deltas_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_deltas_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_deltas_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_deltas_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_deltas_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_deltas_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_deltas_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "startup_signal_deltas_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_deltas_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_deltas_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_signal_history: {
        Row: {
          fundraising_window: string
          id: string
          meta: Json
          power_score: number
          readiness: number
          recorded_at: string
          signal_strength: number
          source: string
          startup_id: string
        }
        Insert: {
          fundraising_window: string
          id?: string
          meta?: Json
          power_score: number
          readiness: number
          recorded_at?: string
          signal_strength: number
          source?: string
          startup_id: string
        }
        Update: {
          fundraising_window?: string
          id?: string
          meta?: Json
          power_score?: number
          readiness?: number
          recorded_at?: string
          signal_strength?: number
          source?: string
          startup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_signal_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "startup_signal_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "startup_signal_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "startup_signal_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "startup_signal_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_signal_snapshots: {
        Row: {
          alignment_score: number | null
          captured_at: string | null
          created_at: string | null
          heat: string | null
          id: string
          match_count: number | null
          observers_7d: number | null
          phase_score: number | null
          signal_band: string | null
          signal_strength: number | null
          startup_id: string | null
          tier_label: string | null
          top_5_investor_ids: string[] | null
          velocity_label: string | null
        }
        Insert: {
          alignment_score?: number | null
          captured_at?: string | null
          created_at?: string | null
          heat?: string | null
          id?: string
          match_count?: number | null
          observers_7d?: number | null
          phase_score?: number | null
          signal_band?: string | null
          signal_strength?: number | null
          startup_id?: string | null
          tier_label?: string | null
          top_5_investor_ids?: string[] | null
          velocity_label?: string | null
        }
        Update: {
          alignment_score?: number | null
          captured_at?: string | null
          created_at?: string | null
          heat?: string | null
          id?: string
          match_count?: number | null
          observers_7d?: number | null
          phase_score?: number | null
          signal_band?: string | null
          signal_strength?: number | null
          startup_id?: string | null
          tier_label?: string | null
          top_5_investor_ids?: string[] | null
          velocity_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "startup_signal_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "startup_signal_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "startup_signal_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "startup_signal_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "startup_signal_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signal_snapshots_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_signals: {
        Row: {
          created_at: string | null
          id: string
          meta: Json | null
          occurred_at: string | null
          signal_type: string
          startup_id: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          meta?: Json | null
          occurred_at?: string | null
          signal_type: string
          startup_id?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          meta?: Json | null
          occurred_at?: string | null
          signal_type?: string
          startup_id?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          intro_emails_used_this_period: number | null
          matches_used_this_period: number | null
          plan_id: string | null
          recommendations_used_this_period: number | null
          startup_id: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          intro_emails_used_this_period?: number | null
          matches_used_this_period?: number | null
          plan_id?: string | null
          recommendations_used_this_period?: number | null
          startup_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          intro_emails_used_this_period?: number | null
          matches_used_this_period?: number | null
          plan_id?: string | null
          recommendations_used_this_period?: number | null
          startup_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_tags: {
        Row: {
          geo_scope: string
          keyword_tags: string[]
          sector_tags: string[]
          startup_id: string
          updated_at: string
        }
        Insert: {
          geo_scope?: string
          keyword_tags?: string[]
          sector_tags?: string[]
          startup_id: string
          updated_at?: string
        }
        Update: {
          geo_scope?: string
          keyword_tags?: string[]
          sector_tags?: string[]
          startup_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      startup_uploads: {
        Row: {
          admin_notes: string | null
          advisors: Json | null
          arr: number | null
          arr_growth_rate: number | null
          benchmark_score: number | null
          build_complexity: string | null
          build_in_public: boolean | null
          cac: number | null
          canonical_key: string | null
          community_score: number | null
          contrarian_belief: string | null
          created_at: string | null
          credential_signals: string[] | null
          customer_count: number | null
          customer_feedback_frequency: string | null
          customer_growth_monthly: number | null
          customer_interviews_conducted: number | null
          customer_pain_data: Json | null
          daily_active_users: number | null
          dau_wau_ratio: number | null
          days_from_idea_to_mvp: number | null
          deck_filename: string | null
          deployment_frequency: string | null
          description: string | null
          discovery_event_id: string | null
          ecosystem_score: number | null
          embedding: string | null
          enabling_technology: string | null
          execution_signals: string[] | null
          experiments_run_last_month: number | null
          extracted_data: Json | null
          features_shipped_last_month: number | null
          first_time_founders: boolean | null
          founder_avg_age: number | null
          founder_blog_active: boolean | null
          founder_education: string[] | null
          founder_graduation_years: number[] | null
          founder_twitter_active: boolean | null
          founder_voice_score: number | null
          founder_youngest_age: number | null
          founders: string[] | null
          founders_under_25: number | null
          founders_under_30: number | null
          grit_score: number | null
          grit_signals: string[] | null
          growth_rate: string | null
          growth_rate_monthly: number | null
          has_customers: boolean | null
          has_demo: boolean | null
          has_revenue: boolean | null
          has_technical_cofounder: boolean | null
          hypotheses_validated: number | null
          icp_clarity: string | null
          id: string
          industry_god_score: number | null
          is_launched: boolean | null
          language_analysis: Json | null
          latest_funding_amount: string | null
          latest_funding_date: string | null
          latest_funding_round: string | null
          lead_investor: string | null
          linkedin: string | null
          location: string | null
          ltv: number | null
          ltv_cac_ratio: number | null
          market_score: number | null
          market_timing_score: number | null
          months_to_1m_arr: number | null
          mrr: number | null
          name: string
          no_votes: number | null
          nps_score: number | null
          nrr: number | null
          organic_referral_rate: number | null
          organic_word_of_mouth: boolean | null
          pitch: string | null
          pivot_history: Json | null
          pivot_speed_days: number | null
          pivots_made: number | null
          platform_dependencies: string[] | null
          primary_industry: string | null
          problem_discovery_depth: string | null
          problem_keywords: string[] | null
          problem_severity: number | null
          problem_validation_score: number | null
          product_score: number | null
          pythia_score: number | null
          raise_amount: string | null
          raise_type: string | null
          revenue_annual: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          sales_cycle_days: number | null
          save_count: number | null
          sectors: string[] | null
          smell_test_inevitable: boolean | null
          smell_test_lean: boolean | null
          smell_test_learning_public: boolean | null
          smell_test_massive_if_works: boolean | null
          smell_test_score: number | null
          smell_test_user_passion: boolean | null
          social_score: number | null
          source_type: string
          source_url: string | null
          stage: number | null
          stage_advanced_at: string | null
          status: string | null
          strategic_partners: Json | null
          submitted_by: string | null
          submitted_email: string | null
          tagline: string | null
          tam_estimate: string | null
          team_score: number | null
          team_signals: string[] | null
          team_size: number | null
          team_size_estimate: number | null
          time_to_first_revenue_months: number | null
          time_to_iterate_days: number | null
          total_god_score: number | null
          total_votes: number | null
          traction_score: number | null
          unfair_advantage: string | null
          updated_at: string | null
          user_testimonial_sentiment: string | null
          users_who_would_be_very_disappointed: number | null
          view_count: number | null
          vision_score: number | null
          vote_score: number | null
          website: string | null
          weekly_active_users: number | null
          weeks_since_idea: number | null
          why_now: string | null
          winner_take_all_market: boolean | null
          yes_votes: number | null
        }
        Insert: {
          admin_notes?: string | null
          advisors?: Json | null
          arr?: number | null
          arr_growth_rate?: number | null
          benchmark_score?: number | null
          build_complexity?: string | null
          build_in_public?: boolean | null
          cac?: number | null
          canonical_key?: string | null
          community_score?: number | null
          contrarian_belief?: string | null
          created_at?: string | null
          credential_signals?: string[] | null
          customer_count?: number | null
          customer_feedback_frequency?: string | null
          customer_growth_monthly?: number | null
          customer_interviews_conducted?: number | null
          customer_pain_data?: Json | null
          daily_active_users?: number | null
          dau_wau_ratio?: number | null
          days_from_idea_to_mvp?: number | null
          deck_filename?: string | null
          deployment_frequency?: string | null
          description?: string | null
          discovery_event_id?: string | null
          ecosystem_score?: number | null
          embedding?: string | null
          enabling_technology?: string | null
          execution_signals?: string[] | null
          experiments_run_last_month?: number | null
          extracted_data?: Json | null
          features_shipped_last_month?: number | null
          first_time_founders?: boolean | null
          founder_avg_age?: number | null
          founder_blog_active?: boolean | null
          founder_education?: string[] | null
          founder_graduation_years?: number[] | null
          founder_twitter_active?: boolean | null
          founder_voice_score?: number | null
          founder_youngest_age?: number | null
          founders?: string[] | null
          founders_under_25?: number | null
          founders_under_30?: number | null
          grit_score?: number | null
          grit_signals?: string[] | null
          growth_rate?: string | null
          growth_rate_monthly?: number | null
          has_customers?: boolean | null
          has_demo?: boolean | null
          has_revenue?: boolean | null
          has_technical_cofounder?: boolean | null
          hypotheses_validated?: number | null
          icp_clarity?: string | null
          id?: string
          industry_god_score?: number | null
          is_launched?: boolean | null
          language_analysis?: Json | null
          latest_funding_amount?: string | null
          latest_funding_date?: string | null
          latest_funding_round?: string | null
          lead_investor?: string | null
          linkedin?: string | null
          location?: string | null
          ltv?: number | null
          ltv_cac_ratio?: number | null
          market_score?: number | null
          market_timing_score?: number | null
          months_to_1m_arr?: number | null
          mrr?: number | null
          name: string
          no_votes?: number | null
          nps_score?: number | null
          nrr?: number | null
          organic_referral_rate?: number | null
          organic_word_of_mouth?: boolean | null
          pitch?: string | null
          pivot_history?: Json | null
          pivot_speed_days?: number | null
          pivots_made?: number | null
          platform_dependencies?: string[] | null
          primary_industry?: string | null
          problem_discovery_depth?: string | null
          problem_keywords?: string[] | null
          problem_severity?: number | null
          problem_validation_score?: number | null
          product_score?: number | null
          pythia_score?: number | null
          raise_amount?: string | null
          raise_type?: string | null
          revenue_annual?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sales_cycle_days?: number | null
          save_count?: number | null
          sectors?: string[] | null
          smell_test_inevitable?: boolean | null
          smell_test_lean?: boolean | null
          smell_test_learning_public?: boolean | null
          smell_test_massive_if_works?: boolean | null
          smell_test_score?: number | null
          smell_test_user_passion?: boolean | null
          social_score?: number | null
          source_type: string
          source_url?: string | null
          stage?: number | null
          stage_advanced_at?: string | null
          status?: string | null
          strategic_partners?: Json | null
          submitted_by?: string | null
          submitted_email?: string | null
          tagline?: string | null
          tam_estimate?: string | null
          team_score?: number | null
          team_signals?: string[] | null
          team_size?: number | null
          team_size_estimate?: number | null
          time_to_first_revenue_months?: number | null
          time_to_iterate_days?: number | null
          total_god_score?: number | null
          total_votes?: number | null
          traction_score?: number | null
          unfair_advantage?: string | null
          updated_at?: string | null
          user_testimonial_sentiment?: string | null
          users_who_would_be_very_disappointed?: number | null
          view_count?: number | null
          vision_score?: number | null
          vote_score?: number | null
          website?: string | null
          weekly_active_users?: number | null
          weeks_since_idea?: number | null
          why_now?: string | null
          winner_take_all_market?: boolean | null
          yes_votes?: number | null
        }
        Update: {
          admin_notes?: string | null
          advisors?: Json | null
          arr?: number | null
          arr_growth_rate?: number | null
          benchmark_score?: number | null
          build_complexity?: string | null
          build_in_public?: boolean | null
          cac?: number | null
          canonical_key?: string | null
          community_score?: number | null
          contrarian_belief?: string | null
          created_at?: string | null
          credential_signals?: string[] | null
          customer_count?: number | null
          customer_feedback_frequency?: string | null
          customer_growth_monthly?: number | null
          customer_interviews_conducted?: number | null
          customer_pain_data?: Json | null
          daily_active_users?: number | null
          dau_wau_ratio?: number | null
          days_from_idea_to_mvp?: number | null
          deck_filename?: string | null
          deployment_frequency?: string | null
          description?: string | null
          discovery_event_id?: string | null
          ecosystem_score?: number | null
          embedding?: string | null
          enabling_technology?: string | null
          execution_signals?: string[] | null
          experiments_run_last_month?: number | null
          extracted_data?: Json | null
          features_shipped_last_month?: number | null
          first_time_founders?: boolean | null
          founder_avg_age?: number | null
          founder_blog_active?: boolean | null
          founder_education?: string[] | null
          founder_graduation_years?: number[] | null
          founder_twitter_active?: boolean | null
          founder_voice_score?: number | null
          founder_youngest_age?: number | null
          founders?: string[] | null
          founders_under_25?: number | null
          founders_under_30?: number | null
          grit_score?: number | null
          grit_signals?: string[] | null
          growth_rate?: string | null
          growth_rate_monthly?: number | null
          has_customers?: boolean | null
          has_demo?: boolean | null
          has_revenue?: boolean | null
          has_technical_cofounder?: boolean | null
          hypotheses_validated?: number | null
          icp_clarity?: string | null
          id?: string
          industry_god_score?: number | null
          is_launched?: boolean | null
          language_analysis?: Json | null
          latest_funding_amount?: string | null
          latest_funding_date?: string | null
          latest_funding_round?: string | null
          lead_investor?: string | null
          linkedin?: string | null
          location?: string | null
          ltv?: number | null
          ltv_cac_ratio?: number | null
          market_score?: number | null
          market_timing_score?: number | null
          months_to_1m_arr?: number | null
          mrr?: number | null
          name?: string
          no_votes?: number | null
          nps_score?: number | null
          nrr?: number | null
          organic_referral_rate?: number | null
          organic_word_of_mouth?: boolean | null
          pitch?: string | null
          pivot_history?: Json | null
          pivot_speed_days?: number | null
          pivots_made?: number | null
          platform_dependencies?: string[] | null
          primary_industry?: string | null
          problem_discovery_depth?: string | null
          problem_keywords?: string[] | null
          problem_severity?: number | null
          problem_validation_score?: number | null
          product_score?: number | null
          pythia_score?: number | null
          raise_amount?: string | null
          raise_type?: string | null
          revenue_annual?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sales_cycle_days?: number | null
          save_count?: number | null
          sectors?: string[] | null
          smell_test_inevitable?: boolean | null
          smell_test_lean?: boolean | null
          smell_test_learning_public?: boolean | null
          smell_test_massive_if_works?: boolean | null
          smell_test_score?: number | null
          smell_test_user_passion?: boolean | null
          social_score?: number | null
          source_type?: string
          source_url?: string | null
          stage?: number | null
          stage_advanced_at?: string | null
          status?: string | null
          strategic_partners?: Json | null
          submitted_by?: string | null
          submitted_email?: string | null
          tagline?: string | null
          tam_estimate?: string | null
          team_score?: number | null
          team_signals?: string[] | null
          team_size?: number | null
          team_size_estimate?: number | null
          time_to_first_revenue_months?: number | null
          time_to_iterate_days?: number | null
          total_god_score?: number | null
          total_votes?: number | null
          traction_score?: number | null
          unfair_advantage?: string | null
          updated_at?: string | null
          user_testimonial_sentiment?: string | null
          users_who_would_be_very_disappointed?: number | null
          view_count?: number | null
          vision_score?: number | null
          vote_score?: number | null
          website?: string | null
          weekly_active_users?: number | null
          weeks_since_idea?: number | null
          why_now?: string | null
          winner_take_all_market?: boolean | null
          yes_votes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "startup_uploads_discovery_event_id_fkey"
            columns: ["discovery_event_id"]
            isOneToOne: false
            referencedRelation: "startup_events"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_velocity_history: {
        Row: {
          archetype_key: string | null
          created_at: string
          customer_velocity_ratio: number
          id: string
          snapshot_date: string
          startup_id: string
          team_velocity_ratio: number
          velocity_gate_met: boolean
          velocity_gate_mode: string
        }
        Insert: {
          archetype_key?: string | null
          created_at?: string
          customer_velocity_ratio?: number
          id?: string
          snapshot_date?: string
          startup_id: string
          team_velocity_ratio?: number
          velocity_gate_met?: boolean
          velocity_gate_mode?: string
        }
        Update: {
          archetype_key?: string | null
          created_at?: string
          customer_velocity_ratio?: number
          id?: string
          snapshot_date?: string
          startup_id?: string
          team_velocity_ratio?: number
          velocity_gate_met?: boolean
          velocity_gate_mode?: string
        }
        Relationships: []
      }
      startup_website_snapshots: {
        Row: {
          captured_at: string
          content_hash: string
          created_at: string
          extracted: Json
          id: string
          startup_id: string
          text_content: string
          url: string
        }
        Insert: {
          captured_at?: string
          content_hash: string
          created_at?: string
          extracted?: Json
          id?: string
          startup_id: string
          text_content: string
          url: string
        }
        Update: {
          captured_at?: string
          content_hash?: string
          created_at?: string
          extracted?: Json
          id?: string
          startup_id?: string
          text_content?: string
          url?: string
        }
        Relationships: []
      }
      story_bookmarks: {
        Row: {
          created_at: string | null
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_bookmarks_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "alignment_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_chapters: {
        Row: {
          alignment_state_at_chapter: string
          chapter_number: number
          chapter_summary: string
          chapter_title: string
          created_at: string | null
          id: string
          investor_reaction: string | null
          key_event: string | null
          story_id: string
          time_delta_months: number | null
        }
        Insert: {
          alignment_state_at_chapter: string
          chapter_number?: number
          chapter_summary: string
          chapter_title: string
          created_at?: string | null
          id?: string
          investor_reaction?: string | null
          key_event?: string | null
          story_id: string
          time_delta_months?: number | null
        }
        Update: {
          alignment_state_at_chapter?: string
          chapter_number?: number
          chapter_summary?: string
          chapter_title?: string
          created_at?: string | null
          id?: string
          investor_reaction?: string | null
          key_event?: string | null
          story_id?: string
          time_delta_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "story_chapters_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "alignment_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_evolution_log: {
        Row: {
          created_at: string | null
          event_description: string | null
          event_type: string
          id: string
          new_state: Json | null
          previous_state: Json | null
          story_id: string
        }
        Insert: {
          created_at?: string | null
          event_description?: string | null
          event_type: string
          id?: string
          new_state?: Json | null
          previous_state?: Json | null
          story_id: string
        }
        Update: {
          created_at?: string | null
          event_description?: string | null
          event_type?: string
          id?: string
          new_state?: Json | null
          previous_state?: Json | null
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_evolution_log_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "alignment_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_products: {
        Row: {
          created_at: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          price_monthly: number
          price_yearly: number | null
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          stripe_product_id: string | null
          tier: string
          updated_at: string | null
          user_type: string
        }
        Insert: {
          created_at?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          price_monthly: number
          price_yearly?: number | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          tier: string
          updated_at?: string | null
          user_type: string
        }
        Update: {
          created_at?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          price_monthly?: number
          price_yearly?: number | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          tier?: string
          updated_at?: string | null
          user_type?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          display_name: string
          features: Json
          id: string
          is_active: boolean | null
          limits: Json
          name: string
          price_monthly: number
          price_yearly: number
        }
        Insert: {
          created_at?: string | null
          display_name: string
          features: Json
          id?: string
          is_active?: boolean | null
          limits: Json
          name: string
          price_monthly: number
          price_yearly: number
        }
        Update: {
          created_at?: string | null
          display_name?: string
          features?: Json
          id?: string
          is_active?: boolean | null
          limits?: Json
          name?: string
          price_monthly?: number
          price_yearly?: number
        }
        Relationships: []
      }
      talent_pool: {
        Row: {
          availability_status: string | null
          candidate_courage: string | null
          candidate_intelligence: string | null
          created_at: string | null
          current_company: string | null
          current_role_name: string | null
          email: string | null
          equity_preference: string | null
          execution_speed: string | null
          experience_level: string
          id: string
          linkedin_url: string | null
          location: string | null
          name: string
          notes: string | null
          previous_startup_experience: boolean | null
          remote_ok: boolean | null
          risk_tolerance: string | null
          sectors: string[] | null
          skill_type: string
          source: string | null
          stage_preference: string[] | null
          updated_at: string | null
          work_style: string | null
          years_experience: number | null
        }
        Insert: {
          availability_status?: string | null
          candidate_courage?: string | null
          candidate_intelligence?: string | null
          created_at?: string | null
          current_company?: string | null
          current_role_name?: string | null
          email?: string | null
          equity_preference?: string | null
          execution_speed?: string | null
          experience_level: string
          id?: string
          linkedin_url?: string | null
          location?: string | null
          name: string
          notes?: string | null
          previous_startup_experience?: boolean | null
          remote_ok?: boolean | null
          risk_tolerance?: string | null
          sectors?: string[] | null
          skill_type: string
          source?: string | null
          stage_preference?: string[] | null
          updated_at?: string | null
          work_style?: string | null
          years_experience?: number | null
        }
        Update: {
          availability_status?: string | null
          candidate_courage?: string | null
          candidate_intelligence?: string | null
          created_at?: string | null
          current_company?: string | null
          current_role_name?: string | null
          email?: string | null
          equity_preference?: string | null
          execution_speed?: string | null
          experience_level?: string
          id?: string
          linkedin_url?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          previous_startup_experience?: boolean | null
          remote_ok?: boolean | null
          risk_tolerance?: string | null
          sectors?: string[] | null
          skill_type?: string
          source?: string | null
          stage_preference?: string[] | null
          updated_at?: string | null
          work_style?: string | null
          years_experience?: number | null
        }
        Relationships: []
      }
      team_success_patterns: {
        Row: {
          created_at: string | null
          criteria: Json | null
          example_exits: string[] | null
          id: string
          industry: string
          pattern_name: string
          source_data: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          criteria?: Json | null
          example_exits?: string[] | null
          id?: string
          industry: string
          pattern_name: string
          source_data?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          criteria?: Json | null
          example_exits?: string[] | null
          id?: string
          industry?: string
          pattern_name?: string
          source_data?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      template_completions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          result_summary: string | null
          startup_id: string
          template_slug: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          result_summary?: string | null
          startup_id: string
          template_slug: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          result_summary?: string | null
          startup_id?: string
          template_slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_completions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "template_completions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "template_completions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "template_completions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_completions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_completions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_completions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_completions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_completions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_completions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_completions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_completions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_completions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_completions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "template_completions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_completions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_completions_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_recommendations: {
        Row: {
          generated_at: string | null
          recommendations: Json
          startup_id: string
          updated_at: string | null
        }
        Insert: {
          generated_at?: string | null
          recommendations?: Json
          startup_id: string
          updated_at?: string | null
        }
        Update: {
          generated_at?: string | null
          recommendations?: Json
          startup_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_recommendations_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "template_recommendations_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "template_recommendations_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "template_recommendations_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_recommendations_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_recommendations_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_recommendations_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_recommendations_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_recommendations_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_recommendations_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_recommendations_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_recommendations_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_recommendations_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_recommendations_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "template_recommendations_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_recommendations_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_recommendations_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      tempo_classes: {
        Row: {
          description: string | null
          key: string
          label: string
          silence_interpretation: string
          typical_industries: string[] | null
        }
        Insert: {
          description?: string | null
          key: string
          label: string
          silence_interpretation: string
          typical_industries?: string[] | null
        }
        Update: {
          description?: string | null
          key?: string
          label?: string
          silence_interpretation?: string
          typical_industries?: string[] | null
        }
        Relationships: []
      }
      tempo_invariants: {
        Row: {
          code: string
          created_at: string | null
          description: string
          id: number
          name: string
          violation_symptom: string
        }
        Insert: {
          code: string
          created_at?: string | null
          description: string
          id: number
          name: string
          violation_symptom: string
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string
          id?: number
          name?: string
          violation_symptom?: string
        }
        Relationships: []
      }
      tempo_profiles: {
        Row: {
          expected_interval_days: number
          half_life_days: number
          id: number
          signal_type: string
          structural_weight: number
          tempo_class: string
          tolerance_multiplier: number
        }
        Insert: {
          expected_interval_days: number
          half_life_days: number
          id?: number
          signal_type: string
          structural_weight?: number
          tempo_class: string
          tolerance_multiplier?: number
        }
        Update: {
          expected_interval_days?: number
          half_life_days?: number
          id?: number
          signal_type?: string
          structural_weight?: number
          tempo_class?: string
          tolerance_multiplier?: number
        }
        Relationships: [
          {
            foreignKeyName: "tempo_profiles_signal_type_fkey"
            columns: ["signal_type"]
            isOneToOne: false
            referencedRelation: "signal_types"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "tempo_profiles_tempo_class_fkey"
            columns: ["tempo_class"]
            isOneToOne: false
            referencedRelation: "tempo_classes"
            referencedColumns: ["key"]
          },
        ]
      }
      user_attribution: {
        Row: {
          last_touch_created_at: string | null
          last_touch_event_id: string | null
          last_touch_name: string | null
          last_touch_properties: Json
          last_touch_source: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          last_touch_created_at?: string | null
          last_touch_event_id?: string | null
          last_touch_name?: string | null
          last_touch_properties?: Json
          last_touch_source?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          last_touch_created_at?: string | null
          last_touch_event_id?: string | null
          last_touch_name?: string | null
          last_touch_properties?: Json
          last_touch_source?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_attribution_last_touch_event_id_fkey"
            columns: ["last_touch_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          billing_cycle: string | null
          billing_email: string | null
          billing_name: string | null
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          email: string
          id: string
          last_payment_amount: number | null
          last_payment_date: string | null
          matches_limit: number | null
          matches_viewed_count: number | null
          next_billing_date: string | null
          payment_status: string | null
          status: string
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          tier: string
          trial_ends_at: string | null
          updated_at: string | null
          user_id: string | null
          user_type: string
        }
        Insert: {
          billing_cycle?: string | null
          billing_email?: string | null
          billing_name?: string | null
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          email: string
          id?: string
          last_payment_amount?: number | null
          last_payment_date?: string | null
          matches_limit?: number | null
          matches_viewed_count?: number | null
          next_billing_date?: string | null
          payment_status?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          user_type?: string
        }
        Update: {
          billing_cycle?: string | null
          billing_email?: string | null
          billing_name?: string | null
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          email?: string
          id?: string
          last_payment_amount?: number | null
          last_payment_date?: string | null
          matches_limit?: number | null
          matches_viewed_count?: number | null
          next_billing_date?: string | null
          payment_status?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          user_type?: string
        }
        Relationships: []
      }
      utility_companies: {
        Row: {
          abbreviation: string | null
          commercial_customers: number | null
          created_at: string | null
          customer_count: number | null
          eia_id: string | null
          headquarters_city: string | null
          id: string
          industrial_customers: number | null
          is_active: boolean | null
          name: string
          phone: string | null
          residential_customers: number | null
          service_territory: string | null
          state_code: string
          updated_at: string | null
          utility_id: string
          utility_type: string | null
          website: string | null
        }
        Insert: {
          abbreviation?: string | null
          commercial_customers?: number | null
          created_at?: string | null
          customer_count?: number | null
          eia_id?: string | null
          headquarters_city?: string | null
          id?: string
          industrial_customers?: number | null
          is_active?: boolean | null
          name: string
          phone?: string | null
          residential_customers?: number | null
          service_territory?: string | null
          state_code: string
          updated_at?: string | null
          utility_id: string
          utility_type?: string | null
          website?: string | null
        }
        Update: {
          abbreviation?: string | null
          commercial_customers?: number | null
          created_at?: string | null
          customer_count?: number | null
          eia_id?: string | null
          headquarters_city?: string | null
          id?: string
          industrial_customers?: number | null
          is_active?: boolean | null
          name?: string
          phone?: string | null
          residential_customers?: number | null
          service_territory?: string | null
          state_code?: string
          updated_at?: string | null
          utility_id?: string
          utility_type?: string | null
          website?: string | null
        }
        Relationships: []
      }
      utility_rates: {
        Row: {
          cache_expires_at: string | null
          city: string | null
          confidence_level: string | null
          created_at: string | null
          data_source: string
          demand_charge: number | null
          demand_charge_non_coincident: number | null
          demand_charge_peak: number | null
          effective_date: string | null
          energy_rate: number
          energy_rate_mid_peak: number | null
          energy_rate_off_peak: number | null
          energy_rate_peak: number | null
          expiration_date: string | null
          fixed_charge_monthly: number | null
          id: string
          is_active: boolean | null
          minimum_bill: number | null
          net_metering_available: boolean | null
          net_metering_type: string | null
          rate_id: string | null
          rate_name: string | null
          rate_type: string
          source_url: string | null
          state_code: string
          tou_schedule: Json | null
          updated_at: string | null
          utility_id: string | null
          utility_name: string
          utility_type: string | null
          zip_code: string
        }
        Insert: {
          cache_expires_at?: string | null
          city?: string | null
          confidence_level?: string | null
          created_at?: string | null
          data_source?: string
          demand_charge?: number | null
          demand_charge_non_coincident?: number | null
          demand_charge_peak?: number | null
          effective_date?: string | null
          energy_rate: number
          energy_rate_mid_peak?: number | null
          energy_rate_off_peak?: number | null
          energy_rate_peak?: number | null
          expiration_date?: string | null
          fixed_charge_monthly?: number | null
          id?: string
          is_active?: boolean | null
          minimum_bill?: number | null
          net_metering_available?: boolean | null
          net_metering_type?: string | null
          rate_id?: string | null
          rate_name?: string | null
          rate_type: string
          source_url?: string | null
          state_code: string
          tou_schedule?: Json | null
          updated_at?: string | null
          utility_id?: string | null
          utility_name: string
          utility_type?: string | null
          zip_code: string
        }
        Update: {
          cache_expires_at?: string | null
          city?: string | null
          confidence_level?: string | null
          created_at?: string | null
          data_source?: string
          demand_charge?: number | null
          demand_charge_non_coincident?: number | null
          demand_charge_peak?: number | null
          effective_date?: string | null
          energy_rate?: number
          energy_rate_mid_peak?: number | null
          energy_rate_off_peak?: number | null
          energy_rate_peak?: number | null
          expiration_date?: string | null
          fixed_charge_monthly?: number | null
          id?: string
          is_active?: boolean | null
          minimum_bill?: number | null
          net_metering_available?: boolean | null
          net_metering_type?: string | null
          rate_id?: string | null
          rate_name?: string | null
          rate_type?: string
          source_url?: string | null
          state_code?: string
          tou_schedule?: Json | null
          updated_at?: string | null
          utility_id?: string | null
          utility_name?: string
          utility_type?: string | null
          zip_code?: string
        }
        Relationships: []
      }
      utility_service_territories: {
        Row: {
          coverage_pct: number | null
          created_at: string | null
          id: string
          is_primary: boolean | null
          utility_id: string
          zip_code: string
        }
        Insert: {
          coverage_pct?: number | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          utility_id: string
          zip_code: string
        }
        Update: {
          coverage_pct?: number | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          utility_id?: string
          zip_code?: string
        }
        Relationships: []
      }
      vc_faith_signals: {
        Row: {
          categories: string[] | null
          confidence: number
          conviction: number
          created_at: string | null
          extracted_at: string | null
          id: string
          investor_id: string | null
          is_active: boolean | null
          metadata: Json
          published_at: string | null
          signal_hash: string
          signal_text: string
          signal_type: string
          source_title: string | null
          source_url: string | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          categories?: string[] | null
          confidence?: number
          conviction?: number
          created_at?: string | null
          extracted_at?: string | null
          id?: string
          investor_id?: string | null
          is_active?: boolean | null
          metadata?: Json
          published_at?: string | null
          signal_hash: string
          signal_text: string
          signal_type: string
          source_title?: string | null
          source_url?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          categories?: string[] | null
          confidence?: number
          conviction?: number
          created_at?: string | null
          extracted_at?: string | null
          id?: string
          investor_id?: string | null
          is_active?: boolean | null
          metadata?: Json
          published_at?: string | null
          signal_hash?: string
          signal_text?: string
          signal_type?: string
          source_title?: string | null
          source_url?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vc_faith_signals_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "vc_faith_signals_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "vc_faith_signals_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_faith_signals_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      vc_portfolio_exhaust: {
        Row: {
          amount: number | null
          cik: string | null
          created_at: string | null
          currency: string | null
          filing_date: string | null
          id: string
          investor_id: string | null
          is_lead: boolean | null
          raw: Json
          round: string | null
          source_type: string
          source_url: string | null
          startup_id: string | null
          startup_name: string | null
          startup_website: string | null
          updated_at: string | null
          validation_status: string | null
        }
        Insert: {
          amount?: number | null
          cik?: string | null
          created_at?: string | null
          currency?: string | null
          filing_date?: string | null
          id?: string
          investor_id?: string | null
          is_lead?: boolean | null
          raw?: Json
          round?: string | null
          source_type: string
          source_url?: string | null
          startup_id?: string | null
          startup_name?: string | null
          startup_website?: string | null
          updated_at?: string | null
          validation_status?: string | null
        }
        Update: {
          amount?: number | null
          cik?: string | null
          created_at?: string | null
          currency?: string | null
          filing_date?: string | null
          id?: string
          investor_id?: string | null
          is_lead?: boolean | null
          raw?: Json
          round?: string | null
          source_type?: string
          source_url?: string | null
          startup_id?: string | null
          startup_name?: string | null
          startup_website?: string | null
          updated_at?: string | null
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vc_portfolio_exhaust_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "vc_portfolio_exhaust_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "vc_portfolio_exhaust_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_portfolio_exhaust_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_portfolio_exhaust_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "vc_portfolio_exhaust_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "vc_portfolio_exhaust_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "vc_portfolio_exhaust_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_portfolio_exhaust_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_portfolio_exhaust_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_portfolio_exhaust_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_portfolio_exhaust_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_portfolio_exhaust_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_portfolio_exhaust_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_portfolio_exhaust_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_portfolio_exhaust_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_portfolio_exhaust_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_portfolio_exhaust_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "vc_portfolio_exhaust_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_portfolio_exhaust_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_portfolio_exhaust_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      vc_signal_validation: {
        Row: {
          created_at: string | null
          evidence: Json
          faith_signal_id: string | null
          id: string
          notes: string | null
          portfolio_exhaust_id: string | null
          validation_label: string
          validation_score: number
        }
        Insert: {
          created_at?: string | null
          evidence?: Json
          faith_signal_id?: string | null
          id?: string
          notes?: string | null
          portfolio_exhaust_id?: string | null
          validation_label: string
          validation_score: number
        }
        Update: {
          created_at?: string | null
          evidence?: Json
          faith_signal_id?: string | null
          id?: string
          notes?: string | null
          portfolio_exhaust_id?: string | null
          validation_label?: string
          validation_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "vc_signal_validation_faith_signal_id_fkey"
            columns: ["faith_signal_id"]
            isOneToOne: false
            referencedRelation: "vc_faith_signals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vc_signal_validation_portfolio_exhaust_id_fkey"
            columns: ["portfolio_exhaust_id"]
            isOneToOne: false
            referencedRelation: "vc_portfolio_exhaust"
            referencedColumns: ["id"]
          },
        ]
      }
      velocity_decay_params: {
        Row: {
          description: string | null
          freshness_days: number | null
          half_life_days: number
          key: string
          max_age_days: number | null
          min_multiplier: number
        }
        Insert: {
          description?: string | null
          freshness_days?: number | null
          half_life_days: number
          key: string
          max_age_days?: number | null
          min_multiplier?: number
        }
        Update: {
          description?: string | null
          freshness_days?: number | null
          half_life_days?: number
          key?: string
          max_age_days?: number | null
          min_multiplier?: number
        }
        Relationships: []
      }
      verification_tokens: {
        Row: {
          created_at: string
          expires_at: string
          founder_email: string
          id: string
          startup_id: string | null
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          founder_email: string
          id?: string
          startup_id?: string | null
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          founder_email?: string
          id?: string
          startup_id?: string | null
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      votes: {
        Row: {
          created_at: string
          id: string
          investor_id: string | null
          metadata: Json
          startup_id: string | null
          story_id: string | null
          updated_at: string
          user_id: string
          vote: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          investor_id?: string | null
          metadata?: Json
          startup_id?: string | null
          story_id?: string | null
          updated_at?: string
          user_id: string
          vote: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          investor_id?: string | null
          metadata?: Json
          startup_id?: string | null
          story_id?: string | null
          updated_at?: string
          user_id?: string
          vote?: string
          weight?: number
        }
        Relationships: []
      }
      watchlists: {
        Row: {
          created_at: string | null
          id: string
          startup_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          startup_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          startup_id?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_digests: {
        Row: {
          bullets: Json
          clicked_at: string | null
          created_at: string
          delivery_channel: string
          digest_week: string
          email_opened_at: string | null
          email_sent_at: string | null
          founder_email: string | null
          founder_session_id: string | null
          headline: string
          id: string
          in_app_shown_at: string | null
          startup_id: string | null
          startup_url: string | null
          status: string
          subject: string
        }
        Insert: {
          bullets?: Json
          clicked_at?: string | null
          created_at?: string
          delivery_channel: string
          digest_week: string
          email_opened_at?: string | null
          email_sent_at?: string | null
          founder_email?: string | null
          founder_session_id?: string | null
          headline: string
          id?: string
          in_app_shown_at?: string | null
          startup_id?: string | null
          startup_url?: string | null
          status?: string
          subject?: string
        }
        Update: {
          bullets?: Json
          clicked_at?: string | null
          created_at?: string
          delivery_channel?: string
          digest_week?: string
          email_opened_at?: string | null
          email_sent_at?: string | null
          founder_email?: string | null
          founder_session_id?: string | null
          headline?: string
          id?: string
          in_app_shown_at?: string | null
          startup_id?: string | null
          startup_url?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
    }
    Views: {
      backtest_first_state_hits: {
        Row: {
          first_hit_date: string | null
          goldilocks_phase_state: string | null
          startup_id: string | null
        }
        Relationships: []
      }
      backtest_summary_goldilocks_v1: {
        Row: {
          label: string | null
          median_days_to_breakout: number | null
          median_days_to_surge: number | null
          median_days_to_warming: number | null
          pct_ever_breakout: number | null
          pct_ever_surge: number | null
          pct_ever_warming: number | null
          startups: number | null
        }
        Relationships: []
      }
      backtest_threshold_grid_current: {
        Row: {
          accel_thr: number | null
          control_false_rate: number | null
          dom_thr: number | null
          irrev_thr: number | null
          pvi_thr: number | null
          separation_score: number | null
          winner_hit_rate: number | null
        }
        Relationships: []
      }
      comparable_startups: {
        Row: {
          comparable_id: string | null
          for_startup_id: string | null
          god_score_delta: number | null
          matched_investors_count: number | null
          name: string | null
          reason_tags: string[] | null
          total_god_score: number | null
        }
        Relationships: []
      }
      convergence_candidates: {
        Row: {
          adjacent_companies: number | null
          check_size_max: number | null
          check_size_min: number | null
          execution_score: number | null
          firm: string | null
          firm_name: string | null
          fomo_state: string | null
          investor_id: string | null
          last_signal_at: string | null
          last_viewed_at: string | null
          market_score: number | null
          match_score: number | null
          overlap_score: number | null
          recent_views: number | null
          sector_focus: string[] | null
          shared_sectors: string[] | null
          signal_24h: number | null
          signal_7d: number | null
          signal_age_hours: number | null
          similar_startups_viewed: number | null
          stage_focus: string[] | null
          startup_id: string | null
          team_score: number | null
          total_god_score: number | null
        }
        Relationships: []
      }
      current_algorithm_weights: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          performance_after: Json | null
          performance_before: Json | null
          weight_updates: Json | null
        }
        Relationships: []
      }
      dashboard_archetype_conversions: {
        Row: {
          avg_signal_change: number | null
          first_seen: string | null
          from_sub_archetype: string | null
          last_seen: string | null
          to_sub_archetype: string | null
          transitions: number | null
        }
        Relationships: []
      }
      dashboard_phase_transitions: {
        Row: {
          domains_active: string[] | null
          high_magnitude: number | null
          irreversible: number | null
          total_transitions: number | null
          transition_date: string | null
          unique_startups: number | null
        }
        Relationships: []
      }
      dashboard_tempo_mismatch: {
        Row: {
          avg_confidence: number | null
          avg_signal_spacing: number | null
          calibration_pending: number | null
          declared_tempo: string | null
          gaming_risk_count: number | null
          mismatch_rate_pct: number | null
          mismatched: number | null
          total_startups: number | null
        }
        Relationships: []
      }
      goldilocks_state_transitions: {
        Row: {
          archetype_description: string | null
          archetype_key: string | null
          last_domain: Database["public"]["Enums"]["phase_domain"] | null
          last_occurred_at: string | null
          last_phase_score: number | null
          last_subtype: string | null
          new_state: string | null
          prev_state: string | null
          snapshot_date: string | null
          startup_id: string | null
        }
        Relationships: []
      }
      goldilocks_transition_feed_v1_1: {
        Row: {
          archetype_description: string | null
          archetype_key: string | null
          is_conviction_goldilocks: number | null
          is_early_goldilocks: number | null
          last_domain: Database["public"]["Enums"]["phase_domain"] | null
          last_occurred_at: string | null
          last_phase_score: number | null
          last_subtype: string | null
          new_state: string | null
          prev_state: string | null
          snapshot_date: string | null
          startup_id: string | null
        }
        Relationships: []
      }
      historical_replay_verdicts: {
        Row: {
          actual_archetype: string | null
          alignment: string | null
          checkpoint_at: string | null
          expected_archetype: string | null
          inv3_hysteresis_check: string | null
          inv4_silence_check: string | null
          inv5_capital_check: string | null
          name: string | null
          phase: string | null
          phase_transition: string | null
          signal: string | null
          silence_assessment: string | null
          silence_days: number | null
          slug: string | null
          stability_score: number | null
          structural_score: number | null
          tempo_class: string | null
          velocity_score: number | null
        }
        Relationships: []
      }
      imminent_funding_predictions: {
        Row: {
          acceleration_factors: string[] | null
          confidence_level: string | null
          funding_probability: number | null
          id: string | null
          name: string | null
          predicted_amount_max: number | null
          predicted_amount_min: number | null
          predicted_round: string | null
          predicted_timeline_months: number | null
          sectors: string[] | null
          total_god_score: number | null
        }
        Relationships: []
      }
      investor_discovery_flow_public: {
        Row: {
          alignment_state: string | null
          created_at: string | null
          created_week: string | null
          id: string | null
          investor_id: string | null
          sector_bucket: string | null
          signal_count: number | null
          stage: string | null
          startup_descriptor: string | null
          top_signals: string[] | null
          trend: string | null
          why_appeared: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_discovery_flow_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_discovery_flow_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_discovery_flow_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_discovery_flow_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_events_weighted: {
        Row: {
          archetype: Database["public"]["Enums"]["investor_archetype"] | null
          archetype_multiplier: number | null
          base_event_weight: number | null
          event_type: Database["public"]["Enums"]["investor_event_type"] | null
          id: number | null
          investor_id: string | null
          investor_tier: string | null
          metadata: Json | null
          occurred_at: string | null
          signal_weight: number | null
          startup_id: string | null
          tier_multiplier: number | null
        }
        Relationships: []
      }
      investor_events_weighted_v1: {
        Row: {
          archetype: string | null
          event_type: string | null
          id: number | null
          investor_id: string | null
          investor_tier: string | null
          metadata: Json | null
          occurred_at: string | null
          signal: number | null
          startup_id: string | null
        }
        Insert: {
          archetype?: never
          event_type?: never
          id?: number | null
          investor_id?: string | null
          investor_tier?: string | null
          metadata?: Json | null
          occurred_at?: string | null
          signal?: never
          startup_id?: string | null
        }
        Update: {
          archetype?: never
          event_type?: never
          id?: number | null
          investor_id?: string | null
          investor_tier?: string | null
          metadata?: Json | null
          occurred_at?: string | null
          signal?: never
          startup_id?: string | null
        }
        Relationships: []
      }
      investor_portfolio_performance: {
        Row: {
          acquisitions: number | null
          investor_id: string | null
          investor_name: string | null
          ipos: number | null
          mergers: number | null
          most_recent_exit: string | null
          total_exit_value: number | null
          total_exits: number | null
          verified_exits: number | null
        }
        Relationships: []
      }
      investor_profile_enriched: {
        Row: {
          active_fund_size: number | null
          avg_response_time_days: number | null
          bio: string | null
          blog_url: string | null
          board_seats: number | null
          check_size_max: number | null
          check_size_min: number | null
          created_at: string | null
          created_by: string | null
          crunchbase_url: string | null
          decision_maker: boolean | null
          dry_powder_estimate: number | null
          email: string | null
          embedding: string | null
          firm: string | null
          focus_areas: Json | null
          follows_rounds: boolean | null
          geography_focus: string[] | null
          id: string | null
          investment_pace_per_year: number | null
          investment_thesis: string | null
          is_verified: boolean | null
          last_enrichment_date: string | null
          last_investment_date: string | null
          last_news_update: string | null
          leads_rounds: boolean | null
          linkedin_url: string | null
          name: string | null
          news_feed_url: string | null
          notable_investments: Json | null
          partner_id: string | null
          partners: Json | null
          photo_url: string | null
          portfolio_companies: string[] | null
          preferred_intro_method: string | null
          recent_activity: Json | null
          recent_news: Json | null
          sectors: string[] | null
          signals: Json | null
          stage: string[] | null
          startup_advice: Json | null
          status: string | null
          successful_exits: number | null
          title: string | null
          total_investments: number | null
          twitter_handle: string | null
          twitter_url: string | null
          typical_ownership_pct: number | null
          updated_at: string | null
        }
        Insert: {
          active_fund_size?: number | null
          avg_response_time_days?: number | null
          bio?: string | null
          blog_url?: string | null
          board_seats?: number | null
          check_size_max?: number | null
          check_size_min?: number | null
          created_at?: string | null
          created_by?: string | null
          crunchbase_url?: string | null
          decision_maker?: boolean | null
          dry_powder_estimate?: number | null
          email?: string | null
          embedding?: string | null
          firm?: string | null
          focus_areas?: Json | null
          follows_rounds?: boolean | null
          geography_focus?: string[] | null
          id?: string | null
          investment_pace_per_year?: number | null
          investment_thesis?: string | null
          is_verified?: boolean | null
          last_enrichment_date?: string | null
          last_investment_date?: string | null
          last_news_update?: string | null
          leads_rounds?: boolean | null
          linkedin_url?: string | null
          name?: string | null
          news_feed_url?: string | null
          notable_investments?: Json | null
          partner_id?: string | null
          partners?: Json | null
          photo_url?: string | null
          portfolio_companies?: string[] | null
          preferred_intro_method?: string | null
          recent_activity?: never
          recent_news?: never
          sectors?: string[] | null
          signals?: Json | null
          stage?: string[] | null
          startup_advice?: Json | null
          status?: string | null
          successful_exits?: number | null
          title?: string | null
          total_investments?: number | null
          twitter_handle?: string | null
          twitter_url?: string | null
          typical_ownership_pct?: number | null
          updated_at?: string | null
        }
        Update: {
          active_fund_size?: number | null
          avg_response_time_days?: number | null
          bio?: string | null
          blog_url?: string | null
          board_seats?: number | null
          check_size_max?: number | null
          check_size_min?: number | null
          created_at?: string | null
          created_by?: string | null
          crunchbase_url?: string | null
          decision_maker?: boolean | null
          dry_powder_estimate?: number | null
          email?: string | null
          embedding?: string | null
          firm?: string | null
          focus_areas?: Json | null
          follows_rounds?: boolean | null
          geography_focus?: string[] | null
          id?: string | null
          investment_pace_per_year?: number | null
          investment_thesis?: string | null
          is_verified?: boolean | null
          last_enrichment_date?: string | null
          last_investment_date?: string | null
          last_news_update?: string | null
          leads_rounds?: boolean | null
          linkedin_url?: string | null
          name?: string | null
          news_feed_url?: string | null
          notable_investments?: Json | null
          partner_id?: string | null
          partners?: Json | null
          photo_url?: string | null
          portfolio_companies?: string[] | null
          preferred_intro_method?: string | null
          recent_activity?: never
          recent_news?: never
          sectors?: string[] | null
          signals?: Json | null
          stage?: string[] | null
          startup_advice?: Json | null
          status?: string | null
          successful_exits?: number | null
          title?: string | null
          total_investments?: number | null
          twitter_handle?: string | null
          twitter_url?: string | null
          typical_ownership_pct?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      investor_startup_fomo: {
        Row: {
          events_24h: number | null
          events_7d: number | null
          investor_id: string | null
          last_signal_at: string | null
          signal_24h: number | null
          signal_7d: number | null
          startup_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_startup_observers_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_startup_observers_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_startup_observers_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_startup_fomo_triggers: {
        Row: {
          events_24h: number | null
          events_7d: number | null
          fomo_ratio: number | null
          fomo_state: string | null
          investor_id: string | null
          last_signal_at: string | null
          signal_24h: number | null
          signal_7d: number | null
          startup_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_startup_observers_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_startup_observers_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_portfolio_performance"
            referencedColumns: ["investor_id"]
          },
          {
            foreignKeyName: "investor_startup_observers_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_profile_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_startup_matches_with_fomo: {
        Row: {
          algorithm_version: string | null
          confidence_level: string | null
          contacted_at: string | null
          created_at: string | null
          created_by: string | null
          feedback_received: boolean | null
          fit_analysis: Json | null
          fomo_boost_decay: number | null
          id: string | null
          intro_email_body: string | null
          intro_email_subject: string | null
          intro_requested_at: string | null
          investor_id: string | null
          last_interaction: string | null
          match_score: number | null
          match_score_fomo: number | null
          reasoning: string | null
          similarity_score: number | null
          startup_id: string | null
          status: string | null
          success_score: number | null
          updated_at: string | null
          user_id: string | null
          viewed_at: string | null
          why_you_match: string[] | null
        }
        Relationships: []
      }
      market_auto_link_preview: {
        Row: {
          event_type: string | null
          geo_scope: string | null
          keyword_overlap: number | null
          market_event_id: string | null
          relevance: number | null
          sector_overlap: number | null
          startup_id: string | null
          title: string | null
        }
        Relationships: []
      }
      monthly_revenue: {
        Row: {
          month: string | null
          revenue_cents: number | null
          revenue_type: string | null
        }
        Relationships: []
      }
      queue_status: {
        Row: {
          count: number | null
          newest: string | null
          oldest: string | null
          status: string | null
        }
        Relationships: []
      }
      recommendation_effectiveness: {
        Row: {
          avg_fit_score: number | null
          conversion_rate: number | null
          meetings_booked: number | null
          startup_id: string | null
          term_sheets: number | null
          total_recommendations: number | null
        }
        Relationships: []
      }
      sources_needing_refresh: {
        Row: {
          auto_refresh: boolean | null
          company_count: number | null
          created_at: string | null
          css_selector: string | null
          id: string | null
          is_active: boolean | null
          last_scraped_at: string | null
          name: string | null
          next_refresh_due: string | null
          refresh_schedule: string | null
          success_rate: number | null
          type: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          auto_refresh?: boolean | null
          company_count?: number | null
          created_at?: string | null
          css_selector?: string | null
          id?: string | null
          is_active?: boolean | null
          last_scraped_at?: string | null
          name?: string | null
          next_refresh_due?: never
          refresh_schedule?: string | null
          success_rate?: number | null
          type?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          auto_refresh?: boolean | null
          company_count?: number | null
          created_at?: string | null
          css_selector?: string | null
          id?: string | null
          is_active?: boolean | null
          last_scraped_at?: string | null
          name?: string | null
          next_refresh_due?: never
          refresh_schedule?: string | null
          success_rate?: number | null
          type?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      startup_agent_crossover: {
        Row: {
          agent_magnitude: number | null
          agent_signals: number | null
          crossover_narrative: string | null
          crossover_stage: string | null
          crossover_triggers: number | null
          customer_count: number | null
          distribution_count: number | null
          first_customer_at: string | null
          last_agent_signal: string | null
          name: string | null
          product_count: number | null
          sectors: string[] | null
          startup_id: string | null
          trigger_agent_plus_customer: number | null
          trigger_agent_plus_distribution: number | null
          trigger_agent_plus_product: number | null
          trigger_customer_after_agent: number | null
        }
        Relationships: []
      }
      startup_agent_traction: {
        Row: {
          agent_signals: number | null
          agent_traction_score: number | null
          days_since_agent_signal: number | null
          last_agent_signal: string | null
          name: string | null
          sectors: string[] | null
          signal_types: string[] | null
          startup_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_traction_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_anonymous_projection: {
        Row: {
          alignment_state: string | null
          anon_id: string | null
          created_week: string | null
          geo_bucket: string | null
          sector_bucket: string | null
          sector_tags: string[] | null
          signal_strength: string | null
          stage_bucket: string | null
          traction_bucket: string | null
        }
        Relationships: []
      }
      startup_breakout_eligible_v1_2: {
        Row: {
          avg_coupling_7d: number | null
          avg_cred_30d: number | null
          avg_customer_tier_30d: number | null
          avg_irrev_7d: number | null
          capital_7d: number | null
          customer_7d: number | null
          customer_velocity_ratio: number | null
          domains_7d: number | null
          goldilocks_phase_state: string | null
          human_7d: number | null
          last_domain: Database["public"]["Enums"]["phase_domain"] | null
          last_evidence: Json | null
          last_occurred_at: string | null
          last_phase_score: number | null
          last_subtype: string | null
          market_7d: number | null
          pcm: number | null
          product_7d: number | null
          pvi_24h: number | null
          pvi_7d: number | null
          pvi_accel_ratio: number | null
          startup_id: string | null
          team_velocity_ratio: number | null
          velocity_gate_met: boolean | null
          velocity_gate_mode: string | null
        }
        Relationships: []
      }
      startup_customer_velocity: {
        Row: {
          avg_customer_tier_30d: number | null
          customer_velocity_ratio: number | null
          customers_30d: number | null
          customers_7d: number | null
          startup_id: string | null
        }
        Relationships: []
      }
      startup_feed_v1_1: {
        Row: {
          archetype_description: string | null
          archetype_key: string | null
          archetype_score: number | null
          avg_coupling_7d: number | null
          avg_irrev_7d: number | null
          capital_7d: number | null
          customer_7d: number | null
          domains_7d: number | null
          goldilocks_phase_state: string | null
          human_7d: number | null
          is_conviction_goldilocks: number | null
          is_early_goldilocks: number | null
          last_domain: Database["public"]["Enums"]["phase_domain"] | null
          last_evidence: Json | null
          last_occurred_at: string | null
          last_phase_score: number | null
          last_subtype: string | null
          market_7d: number | null
          pcm: number | null
          product_7d: number | null
          pvi_24h: number | null
          pvi_7d: number | null
          pvi_accel_ratio: number | null
          startup_id: string | null
        }
        Relationships: []
      }
      startup_fomo_boost: {
        Row: {
          fomo_boost: number | null
          fomo_state: string | null
          startup_id: string | null
          triggered_at: string | null
        }
        Relationships: []
      }
      startup_fomo_by_investor_tier_24h: {
        Row: {
          events_24h: number | null
          investor_tier: string | null
          startup_id: string | null
        }
        Relationships: []
      }
      startup_fomo_by_tier_v1: {
        Row: {
          events_24h: number | null
          investor_tier: string | null
          signal_24h: number | null
          startup_id: string | null
        }
        Relationships: []
      }
      startup_fomo_latest_trigger: {
        Row: {
          events_24h: number | null
          events_7d: number | null
          fomo_ratio: number | null
          fomo_state: string | null
          signal_24h: number | null
          signal_7d: number | null
          signal_delta_24h: number | null
          startup_id: string | null
          triggered_at: string | null
        }
        Relationships: []
      }
      startup_fomo_narratives: {
        Row: {
          elite_signal_24h: number | null
          emerging_signal_24h: number | null
          fomo_ratio: number | null
          fomo_state: string | null
          has_elite_confirmation: boolean | null
          narrative: string | null
          signal_24h: number | null
          signal_delta_24h: number | null
          signal_summary: Json | null
          startup_id: string | null
          strong_signal_24h: number | null
        }
        Relationships: []
      }
      startup_fomo_recent_breakouts: {
        Row: {
          events_24h: number | null
          events_7d: number | null
          fomo_ratio: number | null
          fomo_state: string | null
          id: string | null
          signal_24h: number | null
          signal_7d: number | null
          signal_delta_24h: number | null
          startup_id: string | null
          triggered_at: string | null
        }
        Insert: {
          events_24h?: number | null
          events_7d?: number | null
          fomo_ratio?: number | null
          fomo_state?: string | null
          id?: string | null
          signal_24h?: number | null
          signal_7d?: number | null
          signal_delta_24h?: number | null
          startup_id?: string | null
          triggered_at?: string | null
        }
        Update: {
          events_24h?: number | null
          events_7d?: number | null
          fomo_ratio?: number | null
          fomo_state?: string | null
          id?: string | null
          signal_24h?: number | null
          signal_7d?: number | null
          signal_delta_24h?: number | null
          startup_id?: string | null
          triggered_at?: string | null
        }
        Relationships: []
      }
      startup_fomo_rolling: {
        Row: {
          avg_signal_per_day_7d: number | null
          events_24h: number | null
          events_7d: number | null
          events_prev_24h: number | null
          fomo_ratio: number | null
          signal_24h: number | null
          signal_7d: number | null
          signal_delta_24h: number | null
          signal_prev_24h: number | null
          startup_id: string | null
        }
        Relationships: []
      }
      startup_fomo_rolling_v1: {
        Row: {
          avg_events_per_day_7d: number | null
          avg_signal_per_day_7d: number | null
          delta_events_24h: number | null
          delta_signal_24h: number | null
          events_24h: number | null
          events_7d: number | null
          events_prev_24h: number | null
          fomo_ratio: number | null
          signal_24h: number | null
          signal_7d: number | null
          signal_prev_24h: number | null
          startup_id: string | null
        }
        Relationships: []
      }
      startup_fomo_state: {
        Row: {
          events_24h: number | null
          events_7d: number | null
          fomo_ratio: number | null
          fomo_state: string | null
          signal_24h: number | null
          signal_7d: number | null
          signal_delta_24h: number | null
          startup_id: string | null
          triggered_at: string | null
        }
        Relationships: []
      }
      startup_fomo_tier_24h: {
        Row: {
          elite_events_24h: number | null
          elite_signal_24h: number | null
          emerging_events_24h: number | null
          emerging_signal_24h: number | null
          has_elite_confirmation: boolean | null
          solid_events_24h: number | null
          solid_signal_24h: number | null
          startup_id: string | null
          strong_events_24h: number | null
          strong_signal_24h: number | null
          total_signal_24h: number | null
        }
        Relationships: []
      }
      startup_fomo_trigger_events_live: {
        Row: {
          events_24h: number | null
          events_7d: number | null
          fomo_ratio: number | null
          fomo_state: string | null
          observed_at: string | null
          signal_24h: number | null
          signal_7d: number | null
          signal_delta_24h: number | null
          startup_id: string | null
        }
        Relationships: []
      }
      startup_fomo_triggers: {
        Row: {
          avg_signal_per_day_7d: number | null
          elite_signal_24h: number | null
          emerging_signal_24h: number | null
          events_24h: number | null
          events_7d: number | null
          events_prev_24h: number | null
          fomo_ratio: number | null
          fomo_state: string | null
          has_elite_confirmation: boolean | null
          signal_24h: number | null
          signal_7d: number | null
          signal_delta_24h: number | null
          signal_prev_24h: number | null
          solid_signal_24h: number | null
          startup_id: string | null
          strong_signal_24h: number | null
        }
        Relationships: []
      }
      startup_fomo_triggers_v1: {
        Row: {
          avg_events_per_day_7d: number | null
          avg_signal_per_day_7d: number | null
          delta_events_24h: number | null
          delta_signal_24h: number | null
          events_24h: number | null
          events_7d: number | null
          events_prev_24h: number | null
          fomo_level: number | null
          fomo_ratio: number | null
          fomo_state: string | null
          signal_24h: number | null
          signal_7d: number | null
          signal_prev_24h: number | null
          startup_id: string | null
        }
        Relationships: []
      }
      startup_fomo_weighted_rolling: {
        Row: {
          startup_id: string | null
          weighted_24h: number | null
          weighted_7d: number | null
          weighted_fomo_ratio: number | null
        }
        Relationships: []
      }
      startup_god_scores_with_fomo: {
        Row: {
          computed_at: string | null
          d_determination: number | null
          drivers: Json | null
          fomo_boost: number | null
          fomo_boost_decay: number | null
          g_grit: number | null
          god_score: number | null
          god_score_fomo: number | null
          industry_god_score: number | null
          industry_god_score_fomo: number | null
          o_opportunity: number | null
          startup_id: string | null
        }
        Relationships: []
      }
      startup_goldilocks_by_profile: {
        Row: {
          avg_irrev_7d: number | null
          classification: string | null
          domains_7d: number | null
          goldilocks_phase_state: string | null
          last_domain: Database["public"]["Enums"]["phase_domain"] | null
          last_occurred_at: string | null
          last_phase_score: number | null
          last_subtype: string | null
          profile_key: string | null
          pvi_7d: number | null
          pvi_accel_ratio: number | null
          startup_id: string | null
        }
        Relationships: []
      }
      startup_goldilocks_dashboard: {
        Row: {
          avg_coupling_7d: number | null
          avg_irrev_7d: number | null
          capital_7d: number | null
          customer_7d: number | null
          domains_7d: number | null
          goldilocks_phase_state: string | null
          human_7d: number | null
          last_domain: Database["public"]["Enums"]["phase_domain"] | null
          last_evidence: Json | null
          last_occurred_at: string | null
          last_phase_score: number | null
          last_subtype: string | null
          market_7d: number | null
          pcm: number | null
          product_7d: number | null
          pvi_24h: number | null
          pvi_7d: number | null
          pvi_accel_ratio: number | null
          startup_id: string | null
        }
        Relationships: []
      }
      startup_goldilocks_dashboard_decayed: {
        Row: {
          active_days_7d: number | null
          avg_coupling_7d: number | null
          avg_irrev_7d: number | null
          domains_7d: number | null
          goldilocks_phase_state: string | null
          last_domain: Database["public"]["Enums"]["phase_domain"] | null
          last_evidence: Json | null
          last_occurred_at: string | null
          last_phase_score: number | null
          last_subtype: string | null
          pvi_24h: number | null
          pvi_7d: number | null
          pvi_accel_ratio: number | null
          startup_id: string | null
        }
        Relationships: []
      }
      startup_goldilocks_dashboard_v1_2: {
        Row: {
          avg_coupling_7d: number | null
          avg_cred_30d: number | null
          avg_customer_tier_30d: number | null
          avg_irrev_7d: number | null
          capital_7d: number | null
          customer_7d: number | null
          customer_velocity_ratio: number | null
          domains_7d: number | null
          goldilocks_phase_state: string | null
          human_7d: number | null
          last_domain: Database["public"]["Enums"]["phase_domain"] | null
          last_evidence: Json | null
          last_occurred_at: string | null
          last_phase_score: number | null
          last_subtype: string | null
          market_7d: number | null
          pcm: number | null
          product_7d: number | null
          pvi_24h: number | null
          pvi_7d: number | null
          pvi_accel_ratio: number | null
          startup_id: string | null
          team_velocity_ratio: number | null
        }
        Relationships: []
      }
      startup_goldilocks_phase_triggers: {
        Row: {
          avg_coupling_7d: number | null
          avg_irrev_7d: number | null
          domains_7d: number | null
          goldilocks_phase_state: string | null
          phase_events_24h: number | null
          phase_events_7d: number | null
          pvi_24h: number | null
          pvi_7d: number | null
          pvi_accel_ratio: number | null
          startup_id: string | null
        }
        Relationships: []
      }
      startup_intel_mv: {
        Row: {
          arr: number | null
          benchmark_score: number | null
          contrarian_belief: string | null
          conviction_evidence_gap: number | null
          customer_count: number | null
          customer_interviews_conducted: number | null
          customer_pain_data: Json | null
          dau_wau_ratio: number | null
          days_from_idea_to_mvp: number | null
          deployment_frequency: string | null
          description: string | null
          enabling_technology: string | null
          evidence_score: number | null
          execution_signals: string[] | null
          experiments_run_last_month: number | null
          extracted_data: Json | null
          features_shipped_last_month: number | null
          first_time_founders: boolean | null
          founders_under_25: number | null
          founders_under_30: number | null
          fragility_index: number | null
          grit_signals: string[] | null
          growth_rate: string | null
          growth_rate_monthly: number | null
          has_customers: boolean | null
          has_revenue: boolean | null
          has_technical_cofounder: boolean | null
          hypotheses_validated: number | null
          id: string | null
          industry_god_score: number | null
          is_launched: boolean | null
          language_analysis: Json | null
          market_score: number | null
          market_timing_score: number | null
          momentum_score: number | null
          mrr: number | null
          name: string | null
          narrative_completeness: number | null
          nps_score: number | null
          obsession_density: number | null
          organic_referral_rate: number | null
          pitch: string | null
          pivot_speed_days: number | null
          pivots_made: number | null
          product_score: number | null
          pythia_score: number | null
          revenue_annual: number | null
          smell_test_inevitable: boolean | null
          smell_test_lean: boolean | null
          smell_test_learning_public: boolean | null
          smell_test_massive_if_works: boolean | null
          smell_test_score: number | null
          smell_test_user_passion: boolean | null
          tagline: string | null
          tam_estimate: string | null
          team_score: number | null
          team_size: number | null
          team_size_estimate: number | null
          total_god_score: number | null
          traction_score: number | null
          vision_score: number | null
          website: string | null
          weeks_since_idea: number | null
          why_now: string | null
          winner_take_all_market: boolean | null
        }
        Relationships: []
      }
      startup_intel_mv_v2: {
        Row: {
          arr: number | null
          benchmark_score: number | null
          contrarian_belief: string | null
          conviction_evidence_gap: number | null
          customer_count: number | null
          customer_interviews_conducted: number | null
          customer_pain_data: Json | null
          dau_wau_ratio: number | null
          days_from_idea_to_mvp: number | null
          deployment_frequency: string | null
          description: string | null
          enabling_technology: string | null
          evidence_0_10: number | null
          evidence_score: number | null
          execution_signals: string[] | null
          experiments_run_last_month: number | null
          extracted_data: Json | null
          features_shipped_last_month: number | null
          first_time_founders: boolean | null
          founders_under_25: number | null
          founders_under_30: number | null
          fragility_index: number | null
          grit_signals: string[] | null
          growth_rate: string | null
          growth_rate_monthly: number | null
          has_customers: boolean | null
          has_revenue: boolean | null
          has_technical_cofounder: boolean | null
          hypotheses_validated: number | null
          id: string | null
          industry_god_score: number | null
          investor_signal_0_10: number | null
          is_launched: boolean | null
          language_analysis: Json | null
          market_score: number | null
          market_timing_score: number | null
          momentum_0_10: number | null
          momentum_score: number | null
          mrr: number | null
          name: string | null
          narrative_0_10: number | null
          narrative_completeness: number | null
          nps_score: number | null
          obsession_0_10: number | null
          obsession_density: number | null
          organic_referral_rate: number | null
          pct_evidence: number | null
          pct_fragility: number | null
          pct_gap: number | null
          pct_momentum: number | null
          pct_narrative: number | null
          pct_obsession: number | null
          pct_total_god: number | null
          pitch: string | null
          pivot_speed_days: number | null
          pivots_made: number | null
          product_score: number | null
          proof_alignment_0_10: number | null
          pythia_score: number | null
          resilience_0_10: number | null
          revenue_annual: number | null
          smell_test_inevitable: boolean | null
          smell_test_lean: boolean | null
          smell_test_learning_public: boolean | null
          smell_test_massive_if_works: boolean | null
          smell_test_score: number | null
          smell_test_user_passion: boolean | null
          tagline: string | null
          tam_estimate: string | null
          team_score: number | null
          team_size: number | null
          team_size_estimate: number | null
          total_god_0_10: number | null
          total_god_score: number | null
          traction_score: number | null
          vision_score: number | null
          website: string | null
          weeks_since_idea: number | null
          why_now: string | null
          winner_take_all_market: boolean | null
        }
        Relationships: []
      }
      startup_intel_mv_v4: {
        Row: {
          arr: number | null
          benchmark_score: number | null
          contrarian_belief: string | null
          conviction_evidence_gap: number | null
          cta: string | null
          customer_count: number | null
          customer_interviews_conducted: number | null
          customer_pain_data: Json | null
          dau_wau_ratio: number | null
          days_from_idea_to_mvp: number | null
          deployment_frequency: string | null
          description: string | null
          enabling_technology: string | null
          evidence_0_10: number | null
          evidence_score: number | null
          execution_signals: string[] | null
          experiments_run_last_month: number | null
          extracted_data: Json | null
          features_shipped_last_month: number | null
          first_time_founders: boolean | null
          founders_under_25: number | null
          founders_under_30: number | null
          fragility_index: number | null
          grit_signals: string[] | null
          growth_rate: string | null
          growth_rate_monthly: number | null
          has_customers: boolean | null
          has_revenue: boolean | null
          has_technical_cofounder: boolean | null
          hypotheses_validated: number | null
          id: string | null
          industry_god_score: number | null
          investor_signal_0_10: number | null
          investor_state: string | null
          is_launched: boolean | null
          language_analysis: Json | null
          market_score: number | null
          market_timing_score: number | null
          momentum_0_10: number | null
          momentum_score: number | null
          mrr: number | null
          name: string | null
          narrative_0_10: number | null
          narrative_completeness: number | null
          nps_score: number | null
          obsession_0_10: number | null
          obsession_density: number | null
          organic_referral_rate: number | null
          pct_evidence: number | null
          pct_fragility: number | null
          pct_gap: number | null
          pct_momentum: number | null
          pct_narrative: number | null
          pct_obsession: number | null
          pct_total_god: number | null
          pitch: string | null
          pivot_speed_days: number | null
          pivots_made: number | null
          primary_reason: string | null
          product_score: number | null
          proof_alignment_0_10: number | null
          pythia_score: number | null
          resilience_0_10: number | null
          revenue_annual: number | null
          risk_flag: string | null
          smell_test_inevitable: boolean | null
          smell_test_lean: boolean | null
          smell_test_learning_public: boolean | null
          smell_test_massive_if_works: boolean | null
          smell_test_score: number | null
          smell_test_user_passion: boolean | null
          tagline: string | null
          tam_estimate: string | null
          team_score: number | null
          team_size: number | null
          team_size_estimate: number | null
          total_god_0_10: number | null
          total_god_score: number | null
          traction_score: number | null
          vision_score: number | null
          website: string | null
          weeks_since_idea: number | null
          why_now: string | null
          winner_take_all_market: boolean | null
        }
        Relationships: []
      }
      startup_intel_mv_v5: {
        Row: {
          arr: number | null
          benchmark_score: number | null
          contrarian_belief: string | null
          conviction_evidence_gap: number | null
          cta: string | null
          customer_count: number | null
          customer_interviews_conducted: number | null
          customer_pain_data: Json | null
          dau_wau_ratio: number | null
          days_from_idea_to_mvp: number | null
          deployment_frequency: string | null
          description: string | null
          enabling_technology: string | null
          evidence_0_10: number | null
          evidence_score: number | null
          execution_signals: string[] | null
          experiments_run_last_month: number | null
          extracted_data: Json | null
          features_shipped_last_month: number | null
          first_time_founders: boolean | null
          founders_under_25: number | null
          founders_under_30: number | null
          fragility_index: number | null
          grit_signals: string[] | null
          growth_rate: string | null
          growth_rate_monthly: number | null
          has_customers: boolean | null
          has_revenue: boolean | null
          has_technical_cofounder: boolean | null
          hypotheses_validated: number | null
          id: string | null
          industry_god_score: number | null
          investor_signal_0_10: number | null
          investor_signal_sector_0_10: number | null
          investor_signal_sector_0_100: number | null
          investor_state: string | null
          investor_state_sector: string | null
          investor_state_sector_elite: string | null
          is_launched: boolean | null
          language_analysis: Json | null
          market_score: number | null
          market_timing_score: number | null
          momentum_0_10: number | null
          momentum_score: number | null
          mrr: number | null
          name: string | null
          narrative_0_10: number | null
          narrative_completeness: number | null
          nps_score: number | null
          obsession_0_10: number | null
          obsession_density: number | null
          organic_referral_rate: number | null
          pct_evidence: number | null
          pct_fragility: number | null
          pct_gap: number | null
          pct_momentum: number | null
          pct_narrative: number | null
          pct_obsession: number | null
          pct_total_god: number | null
          pitch: string | null
          pivot_speed_days: number | null
          pivots_made: number | null
          primary_reason: string | null
          product_score: number | null
          proof_alignment_0_10: number | null
          pythia_score: number | null
          resilience_0_10: number | null
          revenue_annual: number | null
          risk_flag: string | null
          sector_count: number | null
          sector_evidence_0_10: number | null
          sector_key: string | null
          sector_momentum_0_10: number | null
          sector_narrative_0_10: number | null
          sector_obsession_0_10: number | null
          sector_proof_alignment_0_10: number | null
          sector_quantile: number | null
          sector_resilience_0_10: number | null
          sector_total_god_0_10: number | null
          smell_test_inevitable: boolean | null
          smell_test_lean: boolean | null
          smell_test_learning_public: boolean | null
          smell_test_massive_if_works: boolean | null
          smell_test_score: number | null
          smell_test_user_passion: boolean | null
          spct_align: number | null
          spct_evd: number | null
          spct_god: number | null
          spct_mom: number | null
          spct_nar: number | null
          spct_obs: number | null
          spct_res: number | null
          tagline: string | null
          tam_estimate: string | null
          team_score: number | null
          team_size: number | null
          team_size_estimate: number | null
          total_god_0_10: number | null
          total_god_score: number | null
          traction_score: number | null
          vision_score: number | null
          website: string | null
          weeks_since_idea: number | null
          why_now: string | null
          winner_take_all_market: boolean | null
        }
        Relationships: []
      }
      startup_intel_v1: {
        Row: {
          arr: number | null
          benchmark_score: number | null
          contrarian_belief: string | null
          conviction_evidence_gap: number | null
          customer_count: number | null
          customer_interviews_conducted: number | null
          customer_pain_data: Json | null
          dau_wau_ratio: number | null
          days_from_idea_to_mvp: number | null
          deployment_frequency: string | null
          description: string | null
          enabling_technology: string | null
          evidence_score: number | null
          execution_signals: string[] | null
          experiments_run_last_month: number | null
          extracted_data: Json | null
          features_shipped_last_month: number | null
          first_time_founders: boolean | null
          founders_under_25: number | null
          founders_under_30: number | null
          fragility_index: number | null
          grit_signals: string[] | null
          growth_rate: string | null
          growth_rate_monthly: number | null
          has_customers: boolean | null
          has_revenue: boolean | null
          has_technical_cofounder: boolean | null
          hypotheses_validated: number | null
          id: string | null
          industry_god_score: number | null
          is_launched: boolean | null
          language_analysis: Json | null
          market_score: number | null
          market_timing_score: number | null
          momentum_score: number | null
          mrr: number | null
          name: string | null
          narrative_completeness: number | null
          nps_score: number | null
          obsession_density: number | null
          organic_referral_rate: number | null
          pitch: string | null
          pivot_speed_days: number | null
          pivots_made: number | null
          product_score: number | null
          pythia_score: number | null
          revenue_annual: number | null
          smell_test_inevitable: boolean | null
          smell_test_lean: boolean | null
          smell_test_learning_public: boolean | null
          smell_test_massive_if_works: boolean | null
          smell_test_score: number | null
          smell_test_user_passion: boolean | null
          tagline: string | null
          tam_estimate: string | null
          team_score: number | null
          team_size: number | null
          team_size_estimate: number | null
          total_god_score: number | null
          traction_score: number | null
          vision_score: number | null
          website: string | null
          weeks_since_idea: number | null
          why_now: string | null
          winner_take_all_market: boolean | null
        }
        Relationships: []
      }
      startup_intel_v2_norm: {
        Row: {
          arr: number | null
          benchmark_score: number | null
          contrarian_belief: string | null
          conviction_evidence_gap: number | null
          customer_count: number | null
          customer_interviews_conducted: number | null
          customer_pain_data: Json | null
          dau_wau_ratio: number | null
          days_from_idea_to_mvp: number | null
          deployment_frequency: string | null
          description: string | null
          enabling_technology: string | null
          evidence_0_10: number | null
          evidence_score: number | null
          execution_signals: string[] | null
          experiments_run_last_month: number | null
          extracted_data: Json | null
          features_shipped_last_month: number | null
          first_time_founders: boolean | null
          founders_under_25: number | null
          founders_under_30: number | null
          fragility_index: number | null
          grit_signals: string[] | null
          growth_rate: string | null
          growth_rate_monthly: number | null
          has_customers: boolean | null
          has_revenue: boolean | null
          has_technical_cofounder: boolean | null
          hypotheses_validated: number | null
          id: string | null
          industry_god_score: number | null
          investor_signal_0_10: number | null
          is_launched: boolean | null
          language_analysis: Json | null
          market_score: number | null
          market_timing_score: number | null
          momentum_0_10: number | null
          momentum_score: number | null
          mrr: number | null
          name: string | null
          narrative_0_10: number | null
          narrative_completeness: number | null
          nps_score: number | null
          obsession_0_10: number | null
          obsession_density: number | null
          organic_referral_rate: number | null
          pct_evidence: number | null
          pct_fragility: number | null
          pct_gap: number | null
          pct_momentum: number | null
          pct_narrative: number | null
          pct_obsession: number | null
          pct_total_god: number | null
          pitch: string | null
          pivot_speed_days: number | null
          pivots_made: number | null
          product_score: number | null
          proof_alignment_0_10: number | null
          pythia_score: number | null
          resilience_0_10: number | null
          revenue_annual: number | null
          smell_test_inevitable: boolean | null
          smell_test_lean: boolean | null
          smell_test_learning_public: boolean | null
          smell_test_massive_if_works: boolean | null
          smell_test_score: number | null
          smell_test_user_passion: boolean | null
          tagline: string | null
          tam_estimate: string | null
          team_score: number | null
          team_size: number | null
          team_size_estimate: number | null
          total_god_0_10: number | null
          total_god_score: number | null
          traction_score: number | null
          vision_score: number | null
          website: string | null
          weeks_since_idea: number | null
          why_now: string | null
          winner_take_all_market: boolean | null
        }
        Relationships: []
      }
      startup_intel_v3_norm: {
        Row: {
          arr: number | null
          benchmark_score: number | null
          contrarian_belief: string | null
          conviction_evidence_gap: number | null
          customer_count: number | null
          customer_interviews_conducted: number | null
          customer_pain_data: Json | null
          dau_wau_ratio: number | null
          days_from_idea_to_mvp: number | null
          deployment_frequency: string | null
          description: string | null
          enabling_technology: string | null
          evidence_0_10: number | null
          evidence_score: number | null
          execution_signals: string[] | null
          experiments_run_last_month: number | null
          extracted_data: Json | null
          features_shipped_last_month: number | null
          first_time_founders: boolean | null
          founders_under_25: number | null
          founders_under_30: number | null
          fragility_index: number | null
          grit_signals: string[] | null
          growth_rate: string | null
          growth_rate_monthly: number | null
          has_customers: boolean | null
          has_revenue: boolean | null
          has_technical_cofounder: boolean | null
          hypotheses_validated: number | null
          id: string | null
          industry_god_score: number | null
          investor_signal_0_10: number | null
          is_launched: boolean | null
          language_analysis: Json | null
          market_score: number | null
          market_timing_score: number | null
          momentum_0_10: number | null
          momentum_score: number | null
          mrr: number | null
          name: string | null
          narrative_0_10: number | null
          narrative_completeness: number | null
          nps_score: number | null
          obsession_0_10: number | null
          obsession_density: number | null
          organic_referral_rate: number | null
          pct_evidence: number | null
          pct_fragility: number | null
          pct_gap: number | null
          pct_momentum: number | null
          pct_narrative: number | null
          pct_obsession: number | null
          pct_total_god: number | null
          pitch: string | null
          pivot_speed_days: number | null
          pivots_made: number | null
          product_score: number | null
          proof_alignment_0_10: number | null
          pythia_score: number | null
          resilience_0_10: number | null
          revenue_annual: number | null
          smell_test_inevitable: boolean | null
          smell_test_lean: boolean | null
          smell_test_learning_public: boolean | null
          smell_test_massive_if_works: boolean | null
          smell_test_score: number | null
          smell_test_user_passion: boolean | null
          tagline: string | null
          tam_estimate: string | null
          team_score: number | null
          team_size: number | null
          team_size_estimate: number | null
          total_god_0_10: number | null
          total_god_score: number | null
          traction_score: number | null
          vision_score: number | null
          website: string | null
          weeks_since_idea: number | null
          why_now: string | null
          winner_take_all_market: boolean | null
        }
        Relationships: []
      }
      startup_intel_v4_product: {
        Row: {
          arr: number | null
          benchmark_score: number | null
          contrarian_belief: string | null
          conviction_evidence_gap: number | null
          cta: string | null
          customer_count: number | null
          customer_interviews_conducted: number | null
          customer_pain_data: Json | null
          dau_wau_ratio: number | null
          days_from_idea_to_mvp: number | null
          deployment_frequency: string | null
          description: string | null
          enabling_technology: string | null
          evidence_0_10: number | null
          evidence_score: number | null
          execution_signals: string[] | null
          experiments_run_last_month: number | null
          extracted_data: Json | null
          features_shipped_last_month: number | null
          first_time_founders: boolean | null
          founders_under_25: number | null
          founders_under_30: number | null
          fragility_index: number | null
          grit_signals: string[] | null
          growth_rate: string | null
          growth_rate_monthly: number | null
          has_customers: boolean | null
          has_revenue: boolean | null
          has_technical_cofounder: boolean | null
          hypotheses_validated: number | null
          id: string | null
          industry_god_score: number | null
          investor_signal_0_10: number | null
          investor_state: string | null
          is_launched: boolean | null
          language_analysis: Json | null
          market_score: number | null
          market_timing_score: number | null
          momentum_0_10: number | null
          momentum_score: number | null
          mrr: number | null
          name: string | null
          narrative_0_10: number | null
          narrative_completeness: number | null
          nps_score: number | null
          obsession_0_10: number | null
          obsession_density: number | null
          organic_referral_rate: number | null
          pct_evidence: number | null
          pct_fragility: number | null
          pct_gap: number | null
          pct_momentum: number | null
          pct_narrative: number | null
          pct_obsession: number | null
          pct_total_god: number | null
          pitch: string | null
          pivot_speed_days: number | null
          pivots_made: number | null
          primary_reason: string | null
          product_score: number | null
          proof_alignment_0_10: number | null
          pythia_score: number | null
          resilience_0_10: number | null
          revenue_annual: number | null
          risk_flag: string | null
          smell_test_inevitable: boolean | null
          smell_test_lean: boolean | null
          smell_test_learning_public: boolean | null
          smell_test_massive_if_works: boolean | null
          smell_test_score: number | null
          smell_test_user_passion: boolean | null
          tagline: string | null
          tam_estimate: string | null
          team_score: number | null
          team_size: number | null
          team_size_estimate: number | null
          total_god_0_10: number | null
          total_god_score: number | null
          traction_score: number | null
          vision_score: number | null
          website: string | null
          weeks_since_idea: number | null
          why_now: string | null
          winner_take_all_market: boolean | null
        }
        Relationships: []
      }
      startup_intel_v5_sector: {
        Row: {
          arr: number | null
          benchmark_score: number | null
          contrarian_belief: string | null
          conviction_evidence_gap: number | null
          cta: string | null
          customer_count: number | null
          customer_interviews_conducted: number | null
          customer_pain_data: Json | null
          dau_wau_ratio: number | null
          days_from_idea_to_mvp: number | null
          deployment_frequency: string | null
          description: string | null
          enabling_technology: string | null
          evidence_0_10: number | null
          evidence_score: number | null
          execution_signals: string[] | null
          experiments_run_last_month: number | null
          extracted_data: Json | null
          features_shipped_last_month: number | null
          first_time_founders: boolean | null
          founders_under_25: number | null
          founders_under_30: number | null
          fragility_index: number | null
          grit_signals: string[] | null
          growth_rate: string | null
          growth_rate_monthly: number | null
          has_customers: boolean | null
          has_revenue: boolean | null
          has_technical_cofounder: boolean | null
          hypotheses_validated: number | null
          id: string | null
          industry_god_score: number | null
          investor_signal_0_10: number | null
          investor_signal_sector_0_10: number | null
          investor_signal_sector_0_100: number | null
          investor_state: string | null
          investor_state_sector: string | null
          investor_state_sector_elite: string | null
          is_launched: boolean | null
          language_analysis: Json | null
          market_score: number | null
          market_timing_score: number | null
          momentum_0_10: number | null
          momentum_score: number | null
          mrr: number | null
          name: string | null
          narrative_0_10: number | null
          narrative_completeness: number | null
          nps_score: number | null
          obsession_0_10: number | null
          obsession_density: number | null
          organic_referral_rate: number | null
          pct_evidence: number | null
          pct_fragility: number | null
          pct_gap: number | null
          pct_momentum: number | null
          pct_narrative: number | null
          pct_obsession: number | null
          pct_total_god: number | null
          pitch: string | null
          pivot_speed_days: number | null
          pivots_made: number | null
          primary_reason: string | null
          product_score: number | null
          proof_alignment_0_10: number | null
          pythia_score: number | null
          resilience_0_10: number | null
          revenue_annual: number | null
          risk_flag: string | null
          sector_count: number | null
          sector_evidence_0_10: number | null
          sector_key: string | null
          sector_momentum_0_10: number | null
          sector_narrative_0_10: number | null
          sector_obsession_0_10: number | null
          sector_proof_alignment_0_10: number | null
          sector_quantile: number | null
          sector_resilience_0_10: number | null
          sector_total_god_0_10: number | null
          smell_test_inevitable: boolean | null
          smell_test_lean: boolean | null
          smell_test_learning_public: boolean | null
          smell_test_massive_if_works: boolean | null
          smell_test_score: number | null
          smell_test_user_passion: boolean | null
          spct_align: number | null
          spct_evd: number | null
          spct_god: number | null
          spct_mom: number | null
          spct_nar: number | null
          spct_obs: number | null
          spct_res: number | null
          tagline: string | null
          tam_estimate: string | null
          team_score: number | null
          team_size: number | null
          team_size_estimate: number | null
          total_god_0_10: number | null
          total_god_score: number | null
          traction_score: number | null
          vision_score: number | null
          website: string | null
          weeks_since_idea: number | null
          why_now: string | null
          winner_take_all_market: boolean | null
        }
        Relationships: []
      }
      startup_investor_card: {
        Row: {
          archetype_key: string | null
          crossover_narrative: string | null
          crossover_stage: string | null
          flap_risk: number | null
          freshness: number | null
          goldilocks_v2_score: number | null
          investment_signal: string | null
          name: string | null
          sectors: string[] | null
          signal_strength: number | null
          silence_assessment: string | null
          silence_interpretation: string | null
          stability_score: number | null
          startup_id: string | null
          structure: number | null
          sub_archetype: string | null
          sub_archetype_description: string | null
          tempo_alignment: string | null
          tempo_alignment_score: number | null
          tempo_class: string | null
          tempo_label: string | null
          tempo_narrative: string | null
          tempo_phase_state: string | null
          three_bullet_thesis: string[] | null
          velocity: number | null
        }
        Relationships: []
      }
      startup_observers_7d: {
        Row: {
          latest_observation: string | null
          observers_7d: number | null
          startup_id: string | null
          total_observer_weight: number | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_startup_observers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_phase_archetypes: {
        Row: {
          archetype_description: string | null
          archetype_key: string | null
          archetype_score: number | null
          startup_id: string | null
        }
        Relationships: []
      }
      startup_phase_change: {
        Row: {
          accel_ratio: number | null
          intensity_ratio: number | null
          phase_change_score: number | null
          phase_state: string | null
          recency_decay: number | null
          signal_24h: number | null
          signal_7d: number | null
          startup_id: string | null
          types_7d: number | null
        }
        Relationships: [
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_phase_ledger: {
        Row: {
          confidence: number | null
          coupling: number | null
          detected_at: string | null
          directionality: number | null
          domain: Database["public"]["Enums"]["phase_domain"] | null
          evidence: Json | null
          irreversibility: number | null
          magnitude: number | null
          occurred_at: string | null
          phase_change_id: string | null
          phase_score: number | null
          startup_id: string | null
          subtype: string | null
          velocity: number | null
        }
        Insert: {
          confidence?: number | null
          coupling?: number | null
          detected_at?: string | null
          directionality?: number | null
          domain?: Database["public"]["Enums"]["phase_domain"] | null
          evidence?: Json | null
          irreversibility?: number | null
          magnitude?: number | null
          occurred_at?: never
          phase_change_id?: string | null
          phase_score?: never
          startup_id?: string | null
          subtype?: string | null
          velocity?: number | null
        }
        Update: {
          confidence?: number | null
          coupling?: number | null
          detected_at?: string | null
          directionality?: number | null
          domain?: Database["public"]["Enums"]["phase_domain"] | null
          evidence?: Json | null
          irreversibility?: number | null
          magnitude?: number | null
          occurred_at?: never
          phase_change_id?: string | null
          phase_score?: never
          startup_id?: string | null
          subtype?: string | null
          velocity?: number | null
        }
        Relationships: []
      }
      startup_phase_ledger_decayed: {
        Row: {
          confidence: number | null
          coupling: number | null
          detected_at: string | null
          directionality: number | null
          domain: Database["public"]["Enums"]["phase_domain"] | null
          evidence: Json | null
          irreversibility: number | null
          magnitude: number | null
          occurred_at: string | null
          phase_change_id: string | null
          phase_score: number | null
          phase_score_decayed: number | null
          startup_id: string | null
          subtype: string | null
          velocity: number | null
        }
        Insert: {
          confidence?: number | null
          coupling?: number | null
          detected_at?: string | null
          directionality?: number | null
          domain?: Database["public"]["Enums"]["phase_domain"] | null
          evidence?: Json | null
          irreversibility?: number | null
          magnitude?: number | null
          occurred_at?: never
          phase_change_id?: string | null
          phase_score?: never
          phase_score_decayed?: never
          startup_id?: string | null
          subtype?: string | null
          velocity?: number | null
        }
        Update: {
          confidence?: number | null
          coupling?: number | null
          detected_at?: string | null
          directionality?: number | null
          domain?: Database["public"]["Enums"]["phase_domain"] | null
          evidence?: Json | null
          irreversibility?: number | null
          magnitude?: number | null
          occurred_at?: never
          phase_change_id?: string | null
          phase_score?: never
          phase_score_decayed?: never
          startup_id?: string | null
          subtype?: string | null
          velocity?: number | null
        }
        Relationships: []
      }
      startup_phase_multiplier: {
        Row: {
          avg_irrev_7d: number | null
          domains_7d: number | null
          goldilocks_phase_state: string | null
          pcm: number | null
          pvi_7d: number | null
          pvi_accel_ratio: number | null
          startup_id: string | null
        }
        Relationships: []
      }
      startup_phase_velocity: {
        Row: {
          avg_coupling_7d: number | null
          avg_irrev_7d: number | null
          domains_7d: number | null
          phase_events_24h: number | null
          phase_events_7d: number | null
          pvi_24h: number | null
          pvi_7d: number | null
          pvi_accel_ratio: number | null
          startup_id: string | null
        }
        Relationships: []
      }
      startup_phase_velocity_decayed: {
        Row: {
          active_days_7d: number | null
          domains_7d: number | null
          phase_events_24h: number | null
          phase_events_7d: number | null
          pvi_24h: number | null
          pvi_7d: number | null
          pvi_accel_ratio: number | null
          startup_id: string | null
        }
        Relationships: []
      }
      startup_signal_rolling: {
        Row: {
          events_24h: number | null
          events_30d: number | null
          events_7d: number | null
          last_signal_at: string | null
          signal_24h: number | null
          signal_30d: number | null
          signal_7d: number | null
          startup_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_signals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_stability_score: {
        Row: {
          demotion_threshold: number | null
          flap_risk: number | null
          freshness_ratio: number | null
          irreversible_signals: number | null
          name: string | null
          newest_signal_days: number | null
          promotion_threshold: number | null
          stability_score: number | null
          startup_id: string | null
          structural_score: number | null
          tempo_class: string | null
          tempo_phase_state: string | null
          total_signals: number | null
          velocity_score: number | null
        }
        Relationships: []
      }
      startup_sub_archetypes: {
        Row: {
          agent_traction_score: number | null
          archetype_description: string | null
          archetype_key: string | null
          archetype_score: number | null
          customer_velocity_effective: number | null
          signal_strength: number | null
          silence_assessment: string | null
          startup_id: string | null
          sub_archetype: string | null
          sub_archetype_description: string | null
          team_velocity_effective: number | null
          tempo_class: string | null
          velocity_freshness: string | null
          velocity_gate_mode: string | null
        }
        Relationships: []
      }
      startup_team_velocity: {
        Row: {
          avg_cred_30d: number | null
          joins_30d: number | null
          joins_7d: number | null
          startup_id: string | null
          team_velocity_ratio: number | null
        }
        Relationships: []
      }
      startup_tempo_alignment: {
        Row: {
          actual_customer_spacing: number | null
          actual_hire_spacing: number | null
          expected_customer_days: number | null
          expected_hire_days: number | null
          expected_ship_days: number | null
          fresh_signals: number | null
          name: string | null
          newest_signal_days: number | null
          silence_interpretation: string | null
          startup_id: string | null
          structural_score: number | null
          tempo_alignment: string | null
          tempo_alignment_score: number | null
          tempo_class: string | null
          tempo_narrative: string | null
          total_signals: number | null
          velocity_score: number | null
        }
        Relationships: []
      }
      startup_tempo_contributions: {
        Row: {
          capital_signals: number | null
          customer_fresh: number | null
          customer_signals: number | null
          expectation_violation: number | null
          fresh_signals: number | null
          freshness_ratio: number | null
          goldilocks_v2_score: number | null
          human_fresh: number | null
          human_signals: number | null
          last_signal_at: string | null
          market_signals: number | null
          name: string | null
          newest_signal_days: number | null
          product_signals: number | null
          sectors: string[] | null
          silence_assessment: string | null
          silence_interpretation: string | null
          startup_id: string | null
          structural_score: number | null
          tempo_class: string | null
          tempo_label: string | null
          tempo_phase_state: string | null
          total_signals: number | null
          velocity_score: number | null
        }
        Relationships: []
      }
      startup_tempo_validation: {
        Row: {
          calibration_pending: boolean | null
          customer_signals: number | null
          data_span_days: number | null
          declared_tempo: string | null
          effective_tempo: string | null
          gaming_risk: boolean | null
          median_signal_spacing: number | null
          mismatch_type: string | null
          name: string | null
          observed_tempo: string | null
          product_signals: number | null
          sectors: string[] | null
          startup_id: string | null
          tempo_confidence: number | null
          tempo_mismatch: boolean | null
          total_signals: number | null
        }
        Relationships: []
      }
      startup_velocity_blocked: {
        Row: {
          archetype_description: string | null
          archetype_key: string | null
          blocker_reason: string | null
          customer_velocity_ratio: number | null
          domains_7d: number | null
          goldilocks_phase_state: string | null
          pvi_7d: number | null
          startup_id: string | null
          team_velocity_ratio: number | null
          velocity_gate_mode: string | null
        }
        Relationships: []
      }
      startup_velocity_effective_v1_3: {
        Row: {
          archetype_key: string | null
          customer_velocity_effective: number | null
          customer_velocity_fresh: boolean | null
          customer_velocity_raw: number | null
          days_old: number | null
          effective_velocity_score: number | null
          last_velocity_snapshot_date: string | null
          startup_id: string | null
          team_velocity_effective: number | null
          team_velocity_fresh: boolean | null
          team_velocity_raw: number | null
        }
        Relationships: []
      }
      startup_velocity_gate_v1_2: {
        Row: {
          archetype_key: string | null
          customer_velocity_ratio: number | null
          startup_id: string | null
          team_velocity_ratio: number | null
          velocity_gate_met: boolean | null
          velocity_gate_mode: string | null
        }
        Relationships: []
      }
      startup_velocity_gate_v1_3: {
        Row: {
          archetype_key: string | null
          customer_velocity_effective: number | null
          customer_velocity_fresh: boolean | null
          effective_velocity_score: number | null
          startup_id: string | null
          team_velocity_effective: number | null
          team_velocity_fresh: boolean | null
          velocity_age_days: number | null
          velocity_freshness: string | null
          velocity_gate_met: boolean | null
          velocity_gate_mode: string | null
        }
        Relationships: []
      }
      startup_vote_analytics: {
        Row: {
          community_score: number | null
          created_at: string | null
          id: string | null
          name: string | null
          no_votes: number | null
          primary_score: number | null
          save_count: number | null
          total_votes: number | null
          updated_at: string | null
          view_count: number | null
          vote_score: number | null
          yes_votes: number | null
        }
        Insert: {
          community_score?: number | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          no_votes?: number | null
          primary_score?: number | null
          save_count?: number | null
          total_votes?: number | null
          updated_at?: string | null
          view_count?: number | null
          vote_score?: number | null
          yes_votes?: number | null
        }
        Update: {
          community_score?: number | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          no_votes?: number | null
          primary_score?: number | null
          save_count?: number | null
          total_votes?: number | null
          updated_at?: string | null
          view_count?: number | null
          vote_score?: number | null
          yes_votes?: number | null
        }
        Relationships: []
      }
      top_funding_candidates: {
        Row: {
          acceleration_factors: string[] | null
          arr: number | null
          confidence_level: string | null
          customer_count: number | null
          funding_probability: number | null
          growth_rate_monthly: number | null
          id: string | null
          investor_interest_score: number | null
          last_calculated_at: string | null
          mrr: number | null
          name: string | null
          predicted_amount_max: number | null
          predicted_amount_min: number | null
          predicted_round: string | null
          predicted_timeline_months: number | null
          risk_factors: string[] | null
          sectors: string[] | null
          total_god_score: number | null
          urgency_score: number | null
        }
        Relationships: []
      }
      tv_moment_demo: {
        Row: {
          freshness: number | null
          goldilocks_v2_score: number | null
          investment_signal: string | null
          name: string | null
          silence_interpretation: string | null
          stability_score: number | null
          startup_id: string | null
          structure: number | null
          sub_archetype: string | null
          tempo_alignment: string | null
          tempo_class: string | null
          tempo_label: string | null
          tempo_phase_state: string | null
          three_bullet_thesis: string[] | null
          velocity: number | null
        }
        Relationships: []
      }
      v_founder_hire_match_quality: {
        Row: {
          alignment_type: string[] | null
          candidate_courage: string | null
          candidate_intelligence: string | null
          founder_courage: string | null
          founder_intelligence: string | null
          match_quality: string | null
          match_score: number | null
          startup_id: string | null
          startup_name: string | null
          status: string | null
          talent_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["comparable_id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "comparable_startups"
            referencedColumns: ["for_startup_id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "convergence_candidates"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "imminent_funding_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v4"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_mv_v5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v2_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v3_norm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v4_product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_intel_v5_sector"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_tempo_validation"
            referencedColumns: ["startup_id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startup_vote_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_hire_matches_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "top_funding_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      v_market_intelligence_summary: {
        Row: {
          confidence_score: number | null
          metric_name: string | null
          metric_type: string | null
          metric_value: Json | null
          period_end: string | null
          period_start: string | null
          sector: string | null
          stage: string | null
          updated_at: string | null
        }
        Insert: {
          confidence_score?: number | null
          metric_name?: string | null
          metric_type?: string | null
          metric_value?: Json | null
          period_end?: string | null
          period_start?: string | null
          sector?: string | null
          stage?: string | null
          updated_at?: string | null
        }
        Update: {
          confidence_score?: number | null
          metric_name?: string | null
          metric_type?: string | null
          metric_value?: Json | null
          period_end?: string | null
          period_start?: string | null
          sector?: string | null
          stage?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      v_matches_normalized: {
        Row: {
          investor_id: string | null
          match_id: string | null
          reasoning: string | null
          score: number | null
          startup_id: string | null
        }
        Insert: {
          investor_id?: never
          match_id?: never
          reasoning?: string | null
          score?: never
          startup_id?: never
        }
        Update: {
          investor_id?: never
          match_id?: never
          reasoning?: string | null
          score?: never
          startup_id?: never
        }
        Relationships: []
      }
      v_top5_matches_by_startup: {
        Row: {
          investor_id: string | null
          match_id: string | null
          rn: number | null
          score: number | null
          startup_id: string | null
        }
        Relationships: []
      }
      velocity_gate_conversion_analysis: {
        Row: {
          archetype_key: string | null
          avg_cust_vel: number | null
          avg_team_vel: number | null
          conv_rate_14d: number | null
          conv_rate_30d: number | null
          converted_14d_count: number | null
          converted_30d_count: number | null
          n_startups: number | null
          velocity_gate_mode: string | null
        }
        Relationships: []
      }
      velocity_gate_conversions: {
        Row: {
          breakout_day: string | null
          converted_14d: boolean | null
          converted_30d: boolean | null
          startup_id: string | null
          surge_day: string | null
        }
        Relationships: []
      }
      website_diff_candidates: {
        Row: {
          change_score: number | null
          new_at: string | null
          new_text: string | null
          old_at: string | null
          old_text: string | null
          startup_id: string | null
          url: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      array_overlap_count: {
        Args: { a: string[]; b: string[] }
        Returns: number
      }
      array_union_count: { Args: { a: string[]; b: string[] }; Returns: number }
      auto_approve_startup: {
        Args: { p_discovered_id: string }
        Returns: string
      }
      auto_enrich_discovery: { Args: { p_id: string }; Returns: boolean }
      auto_link_market_events_by_tags: {
        Args: { events_since?: string; min_relevance?: number }
        Returns: number
      }
      calculate_all_funding_forecasts: {
        Args: never
        Returns: {
          errors: number
          processed: number
          success: number
        }[]
      }
      calculate_funding_forecast: {
        Args: { p_startup_id: string }
        Returns: {
          acceleration_factors: string[] | null
          confidence_level: string | null
          created_at: string | null
          funding_probability: number
          id: string
          investor_interest_score: number
          investor_signals: Json | null
          last_calculated_at: string | null
          market_signals: Json | null
          predicted_amount_max: number | null
          predicted_amount_min: number | null
          predicted_round: string | null
          predicted_timeline_months: number | null
          risk_factors: string[] | null
          startup_id: string
          team_signals: Json | null
          top_investor_matches: string[] | null
          traction_signals: Json | null
          updated_at: string | null
          urgency_score: number
        }
        SetofOptions: {
          from: "*"
          to: "funding_forecasts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      calculate_match_score: {
        Args: {
          p_investor_score: number
          p_investor_sectors: string[]
          p_investor_stages: string[]
          p_startup_god_score: number
          p_startup_sectors: string[]
          p_startup_stage: string
        }
        Returns: number
      }
      calculate_weight_impact: {
        Args: { history_id: string }
        Returns: {
          component: string
          performance_change: number
          weight_change: number
        }[]
      }
      capture_startup_fomo_snapshot: {
        Args: { p_force?: boolean }
        Returns: Json
      }
      check_auto_approval_criteria: {
        Args: { p_startup: Record<string, unknown> }
        Returns: boolean
      }
      check_match_limit: { Args: { p_user_id: string }; Returns: boolean }
      complete_queue_item: {
        Args: { p_error?: string; p_queue_id: string; p_success: boolean }
        Returns: undefined
      }
      compute_silence_floor: {
        Args: {
          p_base_phase: string
          p_has_negative_in_window?: boolean
          p_silence_assessment: string
          p_tempo_class: string
          p_window_days?: number
        }
        Returns: Json
      }
      count_matches: {
        Args: { p_startup_id: string }
        Returns: {
          active: number
          is_ready: boolean
          last_match_at: string
          startup_id: string
          total: number
        }[]
      }
      create_integrity_snapshot: { Args: never; Returns: string }
      daily_pce_automation: { Args: never; Returns: Json }
      decay_multiplier: {
        Args: {
          days_old: number
          half_life_days: number
          min_multiplier?: number
        }
        Returns: number
      }
      decay_velocity_ratio_to_baseline: {
        Args: {
          days_old: number
          half_life_days: number
          min_multiplier?: number
          velocity_ratio: number
        }
        Returns: number
      }
      decayed_phase_score: {
        Args: {
          base_score: number
          domain: Database["public"]["Enums"]["phase_domain"]
          occurred_at: string
        }
        Returns: number
      }
      derive_tier_from_source_type: {
        Args: { source_type: string }
        Returns: number
      }
      detect_phase_changes_from_website_diffs: {
        Args: { min_change?: number }
        Returns: number
      }
      diagnose_pipeline: {
        Args: { p_startup_id: string }
        Returns: {
          active_match_count: number
          diagnosis: string
          last_error: string
          last_match_at: string
          match_count: number
          queue_attempts: number
          queue_status: string
          queue_updated_at: string
          startup_id: string
          system_state: string
        }[]
      }
      domain_to_signal_type: {
        Args: { p_domain: string; p_subtype: string }
        Returns: string
      }
      emit_fomo_trigger_for_startup: {
        Args: { p_startup_id: string }
        Returns: number
      }
      emit_startup_fomo_trigger_events: {
        Args: { p_cooldown?: unknown }
        Returns: number
      }
      enforce_polarity_gate: {
        Args: {
          p_archetype: string
          p_base_phase: string
          p_has_recent_negative?: boolean
          p_stability: number
        }
        Returns: Json
      }
      enrich_and_approve_discovery: { Args: { p_id: string }; Returns: string }
      exec_sql: { Args: { sql_query: string }; Returns: Json }
      exec_sql_modify: { Args: { sql_query: string }; Returns: Json }
      exec_sql_rows: { Args: { sql_query: string }; Returns: Json }
      explain_goldilocks: { Args: { p_startup_id: string }; Returns: Json }
      explain_goldilocks_testcase: {
        Args: { p_as_of?: string; p_test_case_id: string }
        Returns: Json
      }
      generate_matches_for_investor: {
        Args: { p_investor_id: string }
        Returns: number
      }
      generate_matches_for_startup: {
        Args: { p_startup_id: string }
        Returns: number
      }
      get_company_event_count: {
        Args: { company_name: string }
        Returns: {
          count: number
          event_type: string
        }[]
      }
      get_event_type_distribution: {
        Args: never
        Returns: {
          count: number
          event_type: string
        }[]
      }
      get_feedback_training_data: {
        Args: never
        Returns: {
          feedback_count: number
          investor_id: string
          negative_signals: number
          positive_signals: number
          startup_id: string
          total_score: number
        }[]
      }
      get_hidden_gems: {
        Args: { limit_count?: number }
        Returns: {
          praise: number
          praise_pct: number
          startup_name: string
          total_mentions: number
        }[]
      }
      get_match_count_estimate: { Args: never; Returns: number }
      get_next_from_queue: {
        Args: never
        Returns: {
          attempts: number
          id: string
          priority: number
          startup_id: string
        }[]
      }
      get_observers_7d: { Args: { p_startup_id: string }; Returns: number }
      get_platform_breakdown: {
        Args: never
        Returns: {
          avg_engagement: number
          concern: number
          mentions: number
          platform: string
          praise: number
          unique_startups: number
        }[]
      }
      get_red_flag_startups: {
        Args: { limit_count?: number }
        Returns: {
          concern_pct: number
          concerns: number
          startup_name: string
          total_mentions: number
        }[]
      }
      get_role_inference: {
        Args: { p_event_type: string; p_frame_type: string }
        Returns: {
          confidence: number
          object_type: string
          subject_type: string
        }[]
      }
      get_sector_funding_stats: {
        Args: never
        Returns: {
          avg_probability: number
          avg_raise: number
          likely_funded: number
          sector: string
          startup_count: number
        }[]
      }
      get_startup_fomo_state: {
        Args: { p_startup_id: string }
        Returns: string
      }
      get_startup_phase_timeline: {
        Args: { max_events?: number; p_startup_id: string }
        Returns: Json
      }
      get_startup_signals: {
        Args: {
          p_limit?: number
          p_platform?: string
          p_sentiment?: string
          p_startup_name: string
        }
        Returns: {
          author: string
          content: string
          created_at: string
          engagement_score: number
          id: number
          platform: string
          sentiment: string
          source_url: string
          startup_name: string
        }[]
      }
      get_tempo_profile: {
        Args: { p_signal_type: string; p_tempo_class: string }
        Returns: {
          expected_interval_days: number
          half_life_days: number
          structural_weight: number
          tolerance_multiplier: number
        }[]
      }
      get_top_buzz_startups: {
        Args: { limit_count?: number }
        Returns: {
          avg_engagement: number
          buzz_score: number
          concern: number
          concern_pct: number
          help: number
          interest: number
          neutral: number
          praise: number
          praise_pct: number
          startup_name: string
          total_mentions: number
        }[]
      }
      get_top_matches: {
        Args: {
          p_cursor_id?: string
          p_cursor_score?: number
          p_limit?: number
          p_startup_id: string
        }
        Returns: {
          check_size_max: number
          check_size_min: number
          cursor_id: string
          cursor_score: number
          firm: string
          investor_id: string
          investor_name: string
          match_score: number
          reasoning: Json
          sectors: Json
          stage: Json
          status: string
        }[]
      }
      get_trending_startups: {
        Args: { p_hours?: number; p_limit?: number }
        Returns: {
          recent_total_votes: number
          recent_yes_votes: number
          startup_id: string
          startup_name: string
          trending_score: number
        }[]
      }
      get_unread_notification_count:
        | { Args: { p_user_id: string }; Returns: number }
        | { Args: { user_id_param: string }; Returns: number }
      get_user_vote_history: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          created_at: string
          startup_id: string
          startup_name: string
          vote: string
        }[]
      }
      has_observatory_access: { Args: { i: string }; Returns: boolean }
      infer_sectors_from_text: { Args: { p_text: string }; Returns: string[] }
      infer_tempo_class: { Args: { p_sectors: string[] }; Returns: string }
      insert_forum_snippet: {
        Args: {
          p_context_label: string
          p_date_published: string
          p_entity_id: string
          p_entity_type: string
          p_source_created_at_i: number
          p_source_item_id: string
          p_source_type: string
          p_source_url: string
          p_text: string
          p_text_hash: string
          p_tier: number
        }
        Returns: undefined
      }
      insert_observer_event: {
        Args: {
          p_investor_id: string
          p_meta?: Json
          p_source: string
          p_startup_id: string
          p_weight?: number
        }
        Returns: string
      }
      insert_startup_signal: {
        Args: {
          p_meta?: Json
          p_signal_type: string
          p_startup_id: string
          p_weight?: number
        }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      is_email_unsubscribed: {
        Args: { email_address: string }
        Returns: boolean
      }
      is_signal_fresh: {
        Args: {
          p_expected_interval_days: number
          p_signal_timestamp: string
          p_tolerance_multiplier: number
        }
        Returns: boolean
      }
      log_investor_activity: {
        Args: {
          p_action_type: string
          p_investor_id: string
          p_metadata?: Json
          p_startup_id: string
          p_user_id: string
        }
        Returns: string
      }
      lookup_entity_type: {
        Args: { entity_name: string }
        Returns: {
          confidence: number
          entity_type: string
          source: string
        }[]
      }
      manually_queue_startup: {
        Args: { p_priority?: number; p_startup_id: string }
        Returns: boolean
      }
      mark_all_notifications_read: {
        Args: { user_id_param: string }
        Returns: undefined
      }
      mark_notification_read:
        | {
            Args: { notification_id: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.mark_notification_read(notification_id => text), public.mark_notification_read(notification_id => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { notification_id: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.mark_notification_read(notification_id => text), public.mark_notification_read(notification_id => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      market_relevance_score: {
        Args: {
          event_geo: string
          event_keywords: string[]
          event_sector: string[]
          startup_geo: string
          startup_keywords: string[]
          startup_sector: string[]
        }
        Returns: number
      }
      match_investors_to_startup: {
        Args: {
          match_count?: number
          match_threshold?: number
          startup_embedding: string
        }
        Returns: {
          investor_id: string
          similarity: number
        }[]
      }
      materialize_phase_changes_from_capital_signals: {
        Args: { since?: string }
        Returns: number
      }
      materialize_phase_changes_from_customer_proof: {
        Args: { since?: string }
        Returns: number
      }
      materialize_phase_changes_from_human_signals: {
        Args: { since?: string }
        Returns: number
      }
      materialize_phase_changes_from_market_links: {
        Args: { since?: string }
        Returns: number
      }
      normalize_url: { Args: { input_url: string }; Returns: string }
      notification_sent_recently: {
        Args: {
          p_entity_id: string
          p_hours?: number
          p_kind: string
          p_user_id: string
        }
        Returns: boolean
      }
      pg_advisory_unlock: { Args: { key: number }; Returns: boolean }
      pg_try_advisory_lock: { Args: { key: number }; Returns: boolean }
      phase_change_multiplier: {
        Args: {
          avg_irrev_7d: number
          domains_7d: number
          pvi_7d: number
          pvi_accel_ratio: number
        }
        Returns: number
      }
      phase_change_score: {
        Args: {
          confidence: number
          coupling: number
          directionality: number
          irreversibility: number
          magnitude: number
          velocity: number
        }
        Returns: number
      }
      pyth_event_signal: {
        Args: {
          p_archetype: string
          p_event_type: string
          p_investor_tier: string
        }
        Returns: number
      }
      refresh_observatory_telemetry: {
        Args: { target_date?: string }
        Returns: undefined
      }
      replay_startup_timeline: {
        Args: {
          p_end_at: string
          p_start_at: string
          p_step?: string
          p_test_case_slug: string
        }
        Returns: {
          out_alignment: string
          out_checkpoint_at: string
          out_phase: string
          out_signal: string
          out_stability: number
          out_structure: number
          out_velocity: number
        }[]
      }
      resolve_startup_by_url: {
        Args: { p_url: string }
        Returns: {
          canonical_url: string
          reason: string
          resolved: boolean
          startup_id: string
          startup_name: string
        }[]
      }
      run_pce_daily: {
        Args: {
          market_min_relevance?: number
          website_min_change?: number
          window_days?: number
        }
        Returns: Json
      }
      safe_delete_matches: {
        Args: {
          confirmation_code?: string
          investor_ids?: string[]
          match_ids?: string[]
          startup_ids?: string[]
        }
        Returns: {
          deleted_count: number
          message: string
        }[]
      }
      simple_text_change_score: {
        Args: { new_text: string; old_text: string }
        Returns: number
      }
      snapshot_archetype_states: { Args: never; Returns: undefined }
      snapshot_goldilocks_states: { Args: never; Returns: number }
      snapshot_velocity_gates: { Args: never; Returns: number }
      structural_carry: {
        Args: {
          p_signal_timestamp: string
          p_signal_type: string
          p_structural_weight: number
        }
        Returns: number
      }
      tempo_smoke_test: {
        Args: never
        Returns: {
          actual_result: string
          expected_behavior: string
          passed: boolean
          scenario: string
          test_name: string
        }[]
      }
      upsert_signal_history: {
        Args: {
          p_fundraising_window: string
          p_meta?: Json
          p_power_score: number
          p_readiness: number
          p_signal_strength: number
          p_source?: string
          p_startup_id: string
        }
        Returns: string
      }
      velocity_decay_v2: {
        Args: { p_half_life_days: number; p_signal_timestamp: string }
        Returns: number
      }
      verify_tempo_invariants: {
        Args: never
        Returns: {
          check_passed: boolean
          evidence: string
          invariant_code: string
          invariant_id: number
          invariant_name: string
          violation_symptom: string
        }[]
      }
    }
    Enums: {
      investor_archetype:
        | "scout"
        | "conviction"
        | "pack"
        | "thematic"
        | "status"
        | "operator_angel"
      investor_event_type:
        | "view"
        | "click"
        | "save"
        | "intro_request"
        | "comment"
      investor_tier: "1" | "2" | "3" | "elite" | "strong" | "solid" | "emerging"
      phase_domain:
        | "product"
        | "capital"
        | "human"
        | "customer"
        | "market"
        | "agent"
      phase_evidence_source:
        | "scraper"
        | "nlp"
        | "repo"
        | "website"
        | "filing"
        | "social"
        | "human_verified"
        | "partner_signal"
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
    Enums: {
      investor_archetype: [
        "scout",
        "conviction",
        "pack",
        "thematic",
        "status",
        "operator_angel",
      ],
      investor_event_type: [
        "view",
        "click",
        "save",
        "intro_request",
        "comment",
      ],
      investor_tier: ["1", "2", "3", "elite", "strong", "solid", "emerging"],
      phase_domain: [
        "product",
        "capital",
        "human",
        "customer",
        "market",
        "agent",
      ],
      phase_evidence_source: [
        "scraper",
        "nlp",
        "repo",
        "website",
        "filing",
        "social",
        "human_verified",
        "partner_signal",
      ],
    },
  },
} as const
