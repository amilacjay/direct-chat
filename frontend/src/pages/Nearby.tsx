import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { useToast } from '../components/Toast';
import { Avatar } from '../components/Avatar';
import type { NearbyUser, PublicUser } from '../lib/types';

// Fix leaflet's default icon paths broken by bundlers
delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function makeAccentIcon(hue?: number | null) {
  const color = hue != null ? `oklch(0.66 0.19 ${hue})` : 'oklch(0.66 0.19 285)';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 9.625 14 22 14 22S28 23.625 28 14C28 6.268 21.732 0 14 0z" fill="${color}"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
  });
}

function makeSelfIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 9.625 14 22 14 22S28 23.625 28 14C28 6.268 21.732 0 14 0z" fill="oklch(0.74 0.15 158)"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
  });
}

function MapFlyTo({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

function formatDist(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export const Nearby: React.FC = () => {
  const { user, setUser, isGuest } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tab, setTab] = useState<'list' | 'map'>('list');
  const [nearby, setNearby] = useState<NearbyUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [myPos, setMyPos] = useState<[number, number] | null>(null);
  const [sharingEnabled, setSharingEnabled] = useState(!!user?.share_location);
  const [toggling, setToggling] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Redirect guests — they can share location but can't manage settings;
  // allow them through, just don't show settings-only UI
  useEffect(() => {
    if (isGuest) {
      navigate('/app', { replace: true });
    }
  }, [isGuest, navigate]);

  const fetchNearby = useCallback(async () => {
    try {
      const data = await api.get<NearbyUser[]>('/users/nearby');
      setNearby(data);
    } catch {
      // 403 = not sharing; silently clear list
      setNearby([]);
    }
  }, []);

  // Poll nearby every 30s while sharing is on
  useEffect(() => {
    if (!sharingEnabled) {
      setNearby([]);
      if (refreshTimer.current) clearInterval(refreshTimer.current);
      return;
    }
    fetchNearby();
    refreshTimer.current = setInterval(fetchNearby, 30_000);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [sharingEnabled, fetchNearby]);

  // Get own position for map center
  useEffect(() => {
    if (!sharingEnabled || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setMyPos([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: false, maximumAge: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [sharingEnabled]);

  const handleToggle = async () => {
    if (toggling) return;

    const next = !sharingEnabled;

    if (next && !navigator.geolocation) {
      toast('Geolocation is not supported by your browser', 'error');
      return;
    }

    if (next) {
      // Request permission before saving to DB
      setLoading(true);
      const granted = await new Promise<boolean>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          (err) => {
            if (err.code === err.PERMISSION_DENIED) setPermDenied(true);
            resolve(false);
          },
        );
      });
      setLoading(false);

      if (!granted) {
        toast('Location permission denied. Enable it in your browser settings.', 'error');
        return;
      }
    }

    setToggling(true);
    try {
      const updated = await api.patch<PublicUser>('/users/me', { share_location: next });
      setUser(updated);
      setSharingEnabled(next);
      toast(next ? 'Location sharing enabled' : 'Location sharing disabled', 'success');
    } catch {
      toast('Failed to update location sharing', 'error');
    } finally {
      setToggling(false);
    }
  };

  const tabClass = (active: boolean) =>
    `relative px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
      active ? 'border-accent text-accent' : 'border-transparent text-ink-3 hover:text-ink-2'
    }`;

  const mapCenter: [number, number] = myPos ?? [0, 0];
  const mapZoom = myPos ? 13 : 2;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg">
      {/* Mobile header */}
      <div className="flex flex-shrink-0 items-center gap-1 border-b border-line px-2 py-2 md:hidden">
        <button
          onClick={() => navigate('/app')}
          aria-label="Back"
          className="grid h-9 w-9 place-items-center rounded-xl text-ink-3 hover:bg-surface2"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M14.5 5.5 8 12l6.5 6.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="font-display text-lg font-semibold tracking-tight text-ink">Nearby</h1>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="mx-auto w-full max-w-2xl px-4 pt-6 pb-2 flex-shrink-0">
          <h1 className="font-display mb-4 hidden text-2xl font-semibold tracking-tight text-ink md:block">
            Nearby People
          </h1>

          {/* Location sharing toggle */}
          <div className="card mb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">Share my location</p>
                <p className="text-xs text-ink-3 mt-0.5">
                  {sharingEnabled
                    ? 'You are visible to nearby users and can see them'
                    : 'Enable to discover people around you'}
                </p>
                {permDenied && (
                  <p className="text-xs text-warn mt-1">
                    Permission denied. Allow location access in your browser settings.
                  </p>
                )}
              </div>
              <button
                onClick={handleToggle}
                disabled={toggling || loading}
                className="relative inline-flex h-7 w-12 flex-shrink-0 rounded-full p-[3px] transition-colors focus:outline-none disabled:opacity-50"
                style={{ background: sharingEnabled ? 'var(--accent)' : 'var(--surface-hi)' }}
                role="switch"
                aria-checked={sharingEnabled}
              >
                <span
                  className="inline-block h-[22px] w-[22px] rounded-full bg-white shadow transition-transform"
                  style={{ transform: sharingEnabled ? 'translateX(20px)' : 'translateX(0)' }}
                />
              </button>
            </div>
          </div>

          {!sharingEnabled && (
            <div className="rounded-2xl border border-accent-line bg-accent-soft px-4 py-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'var(--accent-soft)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-accent">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth={2} />
                </svg>
              </div>
              <p className="text-sm font-medium text-ink mb-1">Find people near you</p>
              <p className="text-xs text-ink-3">
                Turn on location sharing above to see who's nearby. Only users who share their location can see each other.
              </p>
            </div>
          )}

          {sharingEnabled && (
            <div className="flex border-b border-line mb-0">
              <button className={tabClass(tab === 'list')} onClick={() => setTab('list')}>
                List
              </button>
              <button className={tabClass(tab === 'map')} onClick={() => setTab('map')}>
                Map
              </button>
              <div className="ml-auto flex items-center pr-1">
                <button
                  onClick={() => { setLoading(true); fetchNearby().finally(() => setLoading(false)); }}
                  disabled={loading}
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-3 hover:bg-surface2 disabled:opacity-40"
                  title="Refresh"
                >
                  <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none">
                    <path d="M4 12a8 8 0 0 1 14-5.3L20 9M4 15l1.9 2.3A8 8 0 0 0 20 12" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {sharingEnabled && (
          <div className="flex-1 overflow-hidden mx-auto w-full max-w-2xl">
            {tab === 'list' ? (
              <div className="h-full overflow-y-auto px-4 pb-6">
                {nearby.length === 0 ? (
                  <div className="py-16 text-center text-sm text-ink-4">
                    No one nearby yet. Check back soon!
                  </div>
                ) : (
                  <div className="space-y-2 pt-2">
                    {nearby.map((u) => (
                      <NearbyCard key={u.id} user={u} onToast={toast} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full w-full">
                <MapContainer
                  center={mapCenter}
                  zoom={mapZoom}
                  className="h-full w-full"
                  style={{ background: 'var(--bg)' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                  {myPos && (
                    <>
                      <MapFlyTo center={myPos} />
                      <Marker position={myPos} icon={makeSelfIcon()}>
                        <Popup>You</Popup>
                      </Marker>
                    </>
                  )}
                  {nearby.map((u) => (
                    <Marker
                      key={u.id}
                      position={[u.lat, u.lng]}
                      icon={makeAccentIcon(u.accent_hue)}
                    >
                      <Popup>
                        <div className="flex items-center gap-2 min-w-[140px]">
                          <Avatar src={u.avatar_url} name={u.display_name} size="sm" />
                          <div>
                            <p className="font-semibold text-sm">{u.display_name}</p>
                            <p className="text-xs text-gray-500">{formatDist(u.distance_km)} away</p>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface NearbyCardProps {
  user: NearbyUser;
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const NearbyCard: React.FC<NearbyCardProps> = ({ user: u, onToast }) => {
  const navigate = useNavigate();
  const [addingFriend, setAddingFriend] = useState(false);

  const handleChat = () => navigate(`/app/chat/${u.id}`);

  const handleAddFriend = async () => {
    setAddingFriend(true);
    try {
      await api.post(`/friends/${u.id}`);
      onToast('Friend request sent!', 'success');
    } catch {
      onToast('Could not send friend request', 'error');
    } finally {
      setAddingFriend(false);
    }
  };

  return (
    <div className="card flex items-center gap-3">
      <Avatar src={u.avatar_url} name={u.display_name} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">{u.display_name}</p>
        <p className="text-xs text-ink-3 flex items-center gap-1 mt-0.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {formatDist(u.distance_km)} away
        </p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={handleAddFriend}
          disabled={addingFriend}
          className="btn-ghost text-xs px-2 py-1.5 disabled:opacity-50"
          title="Add friend"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="currentColor"/>
          </svg>
        </button>
        <button
          onClick={handleChat}
          className="btn text-xs px-3 py-1.5"
        >
          Chat
        </button>
      </div>
    </div>
  );
};
