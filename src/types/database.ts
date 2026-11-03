export type Visibility = 'private' | 'friends' | 'shared' | 'public';
export type SharePermission = 'viewer' | 'editor';
export type FriendshipStatus = 'pending' | 'accepted' | 'rejected';
export type ProgressStatus = 'unknown' | 'known' | 'needs_review';
export type StudyActivity = 'reviewing' | 'flashcards' | 'quiz' | 'other';
export type NotificationType = 'friend_request' | 'friend_accepted' | 'reviewer_shared' | 'collaboration' | 'event_reminder' | 'new_message';
export type AIKind = 'summary' | 'key_concepts' | 'flashcards' | 'quiz' | 'explanation';

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  school: string | null;
  course: string | null;
  avatar_url: string | null;
}

export interface Reviewer {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  subject: string | null;
  tags: string[];
  visibility: Visibility;
  created_at: string;
  updated_at: string;
}

export interface ReviewerFile {
  id: string;
  reviewer_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface ReviewerShare {
  id: string;
  reviewer_id: string;
  shared_with: string;
  permission: SharePermission;
  created_at: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
}

export interface Collection {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface CollectionItem {
  collection_id: string;
  reviewer_id: string;
}

export interface FlashcardDeck {
  id: string;
  owner_id: string;
  reviewer_id: string | null;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Flashcard {
  id: string;
  deck_id: string;
  position: number;
  front: string;
  back: string;
}

export interface Quiz {
  id: string;
  owner_id: string;
  reviewer_id: string;
  title: string;
  time_limit_seconds: number | null;
  show_explanations_after: boolean;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  position: number;
  question_type: 'multiple_choice' | 'true_false';
  prompt: string;
  options: string[];
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  user_id: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  total: number | null;
}

export interface StudySession {
  id: string;
  user_id: string;
  reviewer_id: string | null;
  activity: StudyActivity;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
}

export interface AppNotification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  reviewer_id: string | null;
  friendship_id: string | null;
  calendar_event_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  /** Empty once the message is unsent. */
  content: string;
  read_at: string | null;
  created_at: string;
  /** The message this one replies to, in the same conversation. */
  reply_to_id: string | null;
  /** Set when the sender unsent the message for both people. */
  unsent_at: string | null;
}

export interface CalendarEvent {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  reminder_minutes: number | null;
  remind_at: string | null;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIGeneration {
  id: string;
  user_id: string;
  reviewer_id: string;
  kind: AIKind;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  result: unknown;
  error_message: string | null;
  created_at: string;
}
