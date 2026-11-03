import type { NotificationView } from '../services/social';

export interface NotificationMessage {
  text: string;
  to: string;
}

/** Builds the sentence and destination for a notification. */
export function notificationMessage(n: NotificationView): NotificationMessage {
  const who = n.actorName ?? 'Someone';
  const title = n.reviewerTitle ? `"${n.reviewerTitle}"` : 'a reviewer';
  const reviewerLink = n.reviewer_id ? `/reviewers/${n.reviewer_id}` : '/library';

  switch (n.type) {
    case 'friend_request':
      return { text: `${who} sent you a friend request`, to: '/friends' };
    case 'friend_accepted':
      return { text: `${who} accepted your friend request`, to: '/friends' };
    case 'reviewer_shared':
      return { text: `${who} shared ${title} with you`, to: reviewerLink };
    case 'collaboration':
      return { text: `${who} updated ${title}`, to: reviewerLink };
    case 'new_message':
      return { text: `${who} sent you a message`, to: n.actor_id ? `/messages?with=${n.actor_id}` : '/messages' };
    case 'event_reminder':
      return { text: `Reminder: ${n.eventTitle ? `"${n.eventTitle}"` : 'An event'} is coming up`, to: '/calendar' };
    default:
      return { text: 'You have a new notification', to: '/notifications' };
  }
}
