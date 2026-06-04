import { api } from './api';
import { wsClient } from './websocket';
import type { RtcConfig } from './types';

type PeerEventMap = {
  message: { peerId: string; text?: string; photo_token?: string };
  open: { peerId: string };
  failed: { peerId: string };
};

type PeerListener<K extends keyof PeerEventMap> = (data: PeerEventMap[K]) => void;

interface PeerState {
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  isOpen: boolean;
  failTimer: ReturnType<typeof setTimeout> | null;
}

let iceServersCache: RTCIceServer[] | null = null;

async function getIceServers(): Promise<RTCIceServer[]> {
  if (iceServersCache) return iceServersCache;
  try {
    const config = await api.get<RtcConfig>('/rtc-config');
    iceServersCache = config.ice_servers as RTCIceServer[];
    return iceServersCache;
  } catch {
    return [{ urls: 'stun:stun.l.google.com:19302' }];
  }
}

export class PeerManager {
  private peers = new Map<string, PeerState>();
  private listeners = new Map<string, Set<PeerListener<keyof PeerEventMap>>>();

  on<K extends keyof PeerEventMap>(event: K, listener: PeerListener<K>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as PeerListener<keyof PeerEventMap>);
  }

  off<K extends keyof PeerEventMap>(event: K, listener: PeerListener<K>): void {
    this.listeners.get(event)?.delete(listener as PeerListener<keyof PeerEventMap>);
  }

  private emit<K extends keyof PeerEventMap>(event: K, data: PeerEventMap[K]): void {
    this.listeners.get(event)?.forEach((fn) => {
      (fn as PeerListener<K>)(data);
    });
  }

  async getConnection(peerId: string): Promise<PeerState> {
    if (this.peers.has(peerId)) {
      return this.peers.get(peerId)!;
    }

    const iceServers = await getIceServers();
    const pc = new RTCPeerConnection({ iceServers });

    const state: PeerState = {
      pc,
      dc: null,
      isOpen: false,
      failTimer: null,
    };
    this.peers.set(peerId, state);

    // Start 5s failure timer
    state.failTimer = setTimeout(() => {
      if (!state.isOpen) {
        this.emit('failed', { peerId });
        this.closePeer(peerId);
      }
    }, 5000);

    // Forward ICE candidates via WS signal
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        wsClient.send({
          type: 'signal',
          to: peerId,
          data: event.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        if (!state.isOpen) {
          this.emit('failed', { peerId });
          this.closePeer(peerId);
        }
      }
    };

    // Handle incoming data channels (callee side)
    pc.ondatachannel = (event) => {
      const dc = event.channel;
      state.dc = dc;
      this._setupDataChannel(dc, peerId, state);
    };

    return state;
  }

  private _setupDataChannel(dc: RTCDataChannel, peerId: string, state: PeerState): void {
    dc.onopen = () => {
      state.isOpen = true;
      if (state.failTimer !== null) {
        clearTimeout(state.failTimer);
        state.failTimer = null;
      }
      this.emit('open', { peerId });
    };

    dc.onmessage = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as {
          text?: string;
          photo_token?: string;
        };
        this.emit('message', { peerId, ...data });
      } catch {
        // plain text fallback
        this.emit('message', { peerId, text: event.data });
      }
    };

    dc.onerror = () => {
      if (!state.isOpen) {
        this.emit('failed', { peerId });
        this.closePeer(peerId);
      }
    };
  }

  async createOffer(peerId: string): Promise<void> {
    const state = await this.getConnection(peerId);
    const dc = state.pc.createDataChannel('chat');
    state.dc = dc;
    this._setupDataChannel(dc, peerId, state);

    const offer = await state.pc.createOffer();
    await state.pc.setLocalDescription(offer);

    wsClient.send({
      type: 'signal',
      to: peerId,
      data: { type: offer.type, sdp: offer.sdp },
    });
  }

  async handleSignal(
    from: string,
    data: RTCSessionDescriptionInit | RTCIceCandidateInit
  ): Promise<void> {
    const state = await this.getConnection(from);
    const { pc } = state;

    const sdpData = data as RTCSessionDescriptionInit;
    if (sdpData.type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(sdpData));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      wsClient.send({
        type: 'signal',
        to: from,
        data: { type: answer.type, sdp: answer.sdp },
      });
    } else if (sdpData.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(sdpData));
    } else {
      // ICE candidate
      const iceData = data as RTCIceCandidateInit;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(iceData));
      } catch {
        // ignore stale candidates
      }
    }
  }

  sendText(peerId: string, text: string): boolean {
    const state = this.peers.get(peerId);
    if (state?.dc && state.dc.readyState === 'open') {
      state.dc.send(JSON.stringify({ text, ts: Date.now() }));
      return true;
    }
    return false;
  }

  sendData(peerId: string, data: Record<string, unknown>): boolean {
    const state = this.peers.get(peerId);
    if (state?.dc && state.dc.readyState === 'open') {
      state.dc.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  isOpen(peerId: string): boolean {
    return this.peers.get(peerId)?.isOpen ?? false;
  }

  closePeer(peerId: string): void {
    const state = this.peers.get(peerId);
    if (state) {
      if (state.failTimer !== null) clearTimeout(state.failTimer);
      state.dc?.close();
      state.pc.close();
      this.peers.delete(peerId);
    }
  }

  closeAll(): void {
    for (const peerId of this.peers.keys()) {
      this.closePeer(peerId);
    }
  }
}

export const peerManager = new PeerManager();
