export interface PublicUser {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  bio?: string | null;
  location?: string | null;
  gender?: string | null;
  age?: number | null;
  show_gender?: boolean;
  show_age?: boolean;
  is_guest: boolean;
  created_at?: string | null;
  accent_hue?: number | null;
}

export interface OnlineUser {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  gender?: string | null;
  age?: number | null;
  is_guest: boolean;
}

export interface FriendRequest {
  id: string;
  requester: PublicUser;
  created_at: string;
}

export interface Friend {
  user: PublicUser;
  friendship_id: string;
}

export interface NotificationOut {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
  is_guest: boolean;
  user: PublicUser;
}

export interface UpdateProfile {
  display_name?: string;
  bio?: string;
  location?: string;
  gender?: string | null;
  age?: number | null;
  show_gender?: boolean;
  show_age?: boolean;
  appear_online?: boolean;
  accent_hue?: number | null;
}

export interface GuestProfileUpdate {
  display_name?: string;
  gender?: string | null;
  age?: number | null;
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface RtcConfig {
  ice_servers: IceServer[];
}

// WebSocket message shapes
export interface WsPresenceSnapshot {
  type: 'presence';
  data: { event: 'snapshot'; users: OnlineUser[] };
}
export interface WsPresenceJoin {
  type: 'presence';
  data: { event: 'join'; user: OnlineUser };
}
export interface WsPresenceLeave {
  type: 'presence';
  data: { event: 'leave'; id: string };
}
export interface WsSignal {
  type: 'signal';
  from: string;
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
}
export interface WsRelay {
  type: 'relay';
  from: string;
  data: { text?: string; ts?: number; photo_token?: string };
}
export interface WsNotification {
  type: 'notification';
  data: NotificationOut;
}
export interface WsError {
  type: 'error';
  data: { message: string };
}
export interface WsPong {
  type: 'pong';
}

export type WsMessage =
  | WsPresenceSnapshot
  | WsPresenceJoin
  | WsPresenceLeave
  | WsSignal
  | WsRelay
  | WsNotification
  | WsError
  | WsPong;

export interface PhotoUploadResponse {
  token: string;
  expires_at: string;
}

// ---- Albums ----
export interface AlbumImage {
  id: string;
  content_type: string;
  position: number;
}

export interface Album {
  id: string;
  title: string;
  cover_image_id?: string | null;
  position: number;
  images: AlbumImage[];
}

export interface AlbumsUsage {
  used_bytes: number;
  limit_bytes: number;
  album_count: number;
  max_albums: number;
  max_images_per_album: number;
  max_image_bytes: number;
}

export interface MyAlbums {
  albums: Album[];
  has_background: boolean;
  background_image_id?: string | null;
  usage: AlbumsUsage;
  is_guest: boolean;
}

export interface PublicAlbums {
  user_id: string;
  can_view: boolean;
  has_background: boolean;
  albums: Album[];
}
