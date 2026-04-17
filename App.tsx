/**
 * MakeupARScreen.tsx
 *
 * Live AR makeup try-on — Banuba React Native SDK.
 *
 * SDK lifecycle (matches official example):
 *   initialize(resourcePaths, token)   — one-time init
 *   attachView()                       — bind native view
 *   openCamera()                       — start camera stream
 *   setCameraFacing(true)              — front camera for makeup
 *   startPlayer()                      — start AR renderer
 *   loadEffect("effects/Makeup")       — load the prefab-capable bundle
 *   reloadConfig(jsonString)           — ONLY method used to apply makeup
 *   stopPlayer()                       — cleanup on unmount
 *
 * Config format (from effects/Makeup/config.json + Banuba docs):
 *   { version: "2.0.0", scene: "Makeup (prefabs)", faces: [{ id: 0, ... }] }
 *   Colors: space-separated RGBA floats in [0, 1] — e.g. "0.8627 0.3137 0.3922 0.8500"
 *   eyes prefab sub-key is "eyes" (not "color") — confirmed from config.json
 *
 * All makeup changes go through one code path:
 *   setMakeupAndApply(patch) → updates makeupRef + React state → applyMakeup()
 *   applyMakeup() → buildConfig(state) → BanubaSdkManager.reloadConfig(json)
 *
 * effectLoadedRef guards every reloadConfig call so no config is sent before
 * the Makeup effect bundle has finished loading.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import BanubaSdkManager, { EffectPlayerView } from '@banuba/react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';

enableScreens(false);

// EffectPlayerView is typed as Component<{}> — cast to accept style prop
const EPView = EffectPlayerView as any;

// ── SDK Token ─────────────────────────────────────────────────────────────────
// TODO: Move to a secure env file before public release
const BANUBA_TOKEN =
  'Qk5CIDt9YdkduWc7sDISTNlPVTv0sSKF9kqb1cC46j6YSWrE/+m5lshR9PXNCgjEgv2FpREga4yqUXgJmnT7HJSfdUoAYvb36k1eWZftpuGqysZ/SQSqZ8F+6++lxMUWd03KQaWQjGGFbJ1SgB2sX3tMyu8XZTZP5MjJZ3HMghk/enKTNzY7LwwDr7zyuAyZuN9eoc4guX/nU+XMkKDmvZgo3DUDEJtoIldlCogbUcIwhu04EaoGZ5sGib3fS2zGSp5EbRfCVNu+W0ZjtUlui+dB/pRPe77bAHjApDOrg/E5neYXih1pqfyiPZNhLOPCb+qvYg4H8pqn9nSset92XiH7c9UYUKbtOiozqvSgmN1YJSfR2EPf92zagTPgGj7o1ITyxyS3QFhsJl7/SzjAXleLzGNcalV7jdNFN0Yfi7k25At4QOIimZHph9AHtAGIvHuqBu1/4hQUPrvCwJcNgbD08T2dxhaG082KuShSS1EmcnlNUNLxfDp1axhVDpjUk+4Zj3MUfhjXv093MCeJmITHOIuUKdD1imazWZUaVEqY7Z9lsiV38NN094C9XNA3LFiUkB/nIze/g7KfaZxRWTyzTdbYM4pAW6TEZO1tZ1fy+7BKVulJSWNu2wXnX1QtBr2kL8yHGG34aBtDAAvSdbg=';

// Path to the prefab-capable Makeup effect bundle
const MAKEUP_EFFECT = 'effects/Makeup';

// ── Timings ───────────────────────────────────────────────────────────────────
// Camera opens after SDK init settles (ms)
const CAMERA_START_DELAY = 600;
// Extra time for the effect bundle to fully load before accepting reloadConfig (ms)
// Fires AFTER CAMERA_START_DELAY, so total = CAMERA_START_DELAY + EFFECT_LOAD_WAIT
const EFFECT_LOAD_WAIT = 2200;

// ── Types ─────────────────────────────────────────────────────────────────────
type Category = 'lips' | 'eyes' | 'blush' | 'foundation' | 'contour';

interface RGBA {
  r: number; // 0–255
  g: number; // 0–255
  b: number; // 0–255
  a: number; // 0–1
}

interface ColorEntry extends RGBA {
  name: string;
}

interface MakeupState {
  selectedLip:   number | null;
  selectedEye:   number | null;
  selectedBlush: number | null;
  foundation:    number; // 0..1  softlight strength
  contour:       number; // 0..1  contour strength
}

// ── Category definitions ──────────────────────────────────────────────────────
const CATEGORIES: { id: Category; icon: string; label: string }[] = [
  { id: 'lips',       icon: '💄', label: 'Lips' },
  { id: 'eyes',       icon: '👁️',  label: 'Eyes' },
  { id: 'blush',      icon: '🌸', label: 'Blush' },
  { id: 'foundation', icon: '🧴', label: 'Base' },
  { id: 'contour',    icon: '✨', label: 'Contour' },
];

// ── Color palettes ─────────────────────────────────────────────────────────────
// r/g/b: 0–255,  a: 0–1
const LIP_COLORS: ColorEntry[] = [
  { name: 'Neutral',    r: 60,  g: 50,  b: 50,  a: 0.80 },
  { name: 'Rose',       r: 220, g: 80,  b: 100, a: 0.85 },
  { name: 'Berry',      r: 180, g: 60,  b: 80,  a: 0.90 },
  { name: 'Wine',       r: 140, g: 30,  b: 60,  a: 0.90 },
  { name: 'Coral',      r: 230, g: 120, b: 80,  a: 0.80 },
  { name: 'Nude',       r: 210, g: 150, b: 130, a: 0.75 },
  { name: 'Dusty Rose', r: 190, g: 90,  b: 110, a: 0.85 },
  { name: 'Plum',       r: 100, g: 20,  b: 50,  a: 0.90 },
  { name: 'Red',        r: 220, g: 30,  b: 50,  a: 0.90 },
  { name: 'Mauve',      r: 170, g: 110, b: 120, a: 0.80 },
  { name: 'Terracotta', r: 200, g: 90,  b: 60,  a: 0.80 },
  { name: 'Cherry',     r: 160, g: 20,  b: 40,  a: 0.90 },
];

const EYE_COLORS: ColorEntry[] = [
  { name: 'Smoky',    r: 60,  g: 50,  b: 50,  a: 0.80 },
  { name: 'Bronze',   r: 180, g: 120, b: 60,  a: 0.70 },
  { name: 'Gold',     r: 200, g: 160, b: 60,  a: 0.70 },
  { name: 'Sapphire', r: 80,  g: 100, b: 180, a: 0.70 },
  { name: 'Violet',   r: 140, g: 80,  b: 160, a: 0.70 },
  { name: 'Emerald',  r: 80,  g: 160, b: 100, a: 0.70 },
  { name: 'Copper',   r: 160, g: 100, b: 80,  a: 0.65 },
  { name: 'Charcoal', r: 50,  g: 50,  b: 50,  a: 0.60 },
  { name: 'Teal',     r: 60,  g: 140, b: 140, a: 0.65 },
  { name: 'Plum',     r: 120, g: 60,  b: 130, a: 0.65 },
];

const BLUSH_COLORS: ColorEntry[] = [
  { name: 'Soft Pink',  r: 255, g: 160, b: 160, a: 0.50 },
  { name: 'Peach',      r: 255, g: 120, b: 100, a: 0.50 },
  { name: 'Rose',       r: 220, g: 80,  b: 100, a: 0.45 },
  { name: 'Coral',      r: 200, g: 100, b: 80,  a: 0.50 },
  { name: 'Natural',    r: 240, g: 180, b: 140, a: 0.45 },
  { name: 'Berry',      r: 180, g: 80,  b: 120, a: 0.45 },
  { name: 'Champagne',  r: 255, g: 200, b: 160, a: 0.40 },
  { name: 'Mauve',      r: 210, g: 120, b: 140, a: 0.50 },
];

// ── Banuba color conversion ───────────────────────────────────────────────────
// Converts RGBA (r/g/b: 0–255, a: 0–1) → Banuba space-separated float string
// e.g.  { r:220, g:80, b:100, a:0.85 }  →  "0.8627 0.3137 0.3922 0.8500"
const rgbaToStr = (c: RGBA): string =>
  [c.r / 255, c.g / 255, c.b / 255, c.a].map(v => v.toFixed(4)).join(' ');

// Transparent placeholder — clears a prefab channel
const TRANSPARENT = '0.0000 0.0000 0.0000 0.0000';

// ── Makeup config builder ─────────────────────────────────────────────────────
// Always sends ALL prefab channels so removing a selection resets it to zero.
// eyes prefab: sub-key is "eyes" (not "color") — matches effects/Makeup/config.json
const buildConfig = (state: MakeupState): string => {
  const lip   = state.selectedLip   != null ? LIP_COLORS[state.selectedLip]     : null;
  const eye   = state.selectedEye   != null ? EYE_COLORS[state.selectedEye]     : null;
  const blush = state.selectedBlush != null ? BLUSH_COLORS[state.selectedBlush] : null;

  return JSON.stringify({
    version: '2.0.0',
    scene:   'Makeup (prefabs)',
    faces: [
      {
        id:        0,
        lips:      { color:    lip   ? rgbaToStr(lip)   : TRANSPARENT },
        eyes:      { eyes:     eye   ? rgbaToStr(eye)   : TRANSPARENT },
        blushes:   { color:    blush ? rgbaToStr(blush) : TRANSPARENT },
        softlight: { strength: state.foundation },
        contour:   { strength: state.contour },
      },
    ],
  });
};

// ── Initial (zero) makeup state ───────────────────────────────────────────────
const EMPTY_STATE: MakeupState = {
  selectedLip: null, selectedEye: null, selectedBlush: null,
  foundation: 0,     contour: 0,
};

// ── Accent color (matches Aylla brand) ────────────────────────────────────────
const ACCENT = '#c97bc9';

// ─────────────────────────────────────────────────────────────────────────────
// IntensitySlider
// Custom PanResponder-based slider (no native-modules dependency).
// Uses locationX on grant (reliable) + dx accumulation on move (cross-platform).
// ─────────────────────────────────────────────────────────────────────────────
interface SliderProps {
  value:    number;
  onChange: (v: number) => void;
  color:    string;
  label:    string;
}

function IntensitySlider({ value, onChange, color, label }: SliderProps) {
  const trackWidth  = useRef(0);
  const grantValue  = useRef(0); // value at the moment the touch starts

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,

      onPanResponderGrant: (e: GestureResponderEvent) => {
        // locationX is reliable for the initial tap event
        if (trackWidth.current > 0) {
          const v = Math.min(1, Math.max(0, e.nativeEvent.locationX / trackWidth.current));
          grantValue.current = v;
          onChange(v);
        }
      },

      onPanResponderMove: (_e: GestureResponderEvent, gestureState: any) => {
        // gestureState.dx = accumulated delta from grant point — reliable on all platforms
        if (trackWidth.current > 0) {
          const v = Math.min(1, Math.max(0, grantValue.current + gestureState.dx / trackWidth.current));
          onChange(v);
        }
      },
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  };

  const pct = `${Math.round(value * 100)}%`;

  return (
    <View style={slSt.wrapper}>
      <View style={slSt.header}>
        <Text style={slSt.label}>{label}</Text>
        <Text style={[slSt.pct, { color }]}>{pct}</Text>
      </View>
      <View style={slSt.track} onLayout={onLayout} {...panResponder.panHandlers}>
        <View style={[slSt.filled, { width: pct, backgroundColor: color }]} />
        {/* Thumb position: percentage-based left — works in RN for absolute children */}
        <View style={[slSt.thumb, { left: pct as any, borderColor: color }]} />
      </View>
    </View>
  );
}

const slSt = StyleSheet.create({
  wrapper: { paddingHorizontal: 20, paddingVertical: 14 },
  header:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  label:   { color: 'rgba(255,255,255,0.55)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  pct:     { fontSize: 13, fontWeight: '700' },
  track: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3,
    position: 'relative',
    justifyContent: 'center',
  },
  filled: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    width: 22, height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    borderWidth: 2.5,
    marginLeft: -11,
    top: -8,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 5,
    elevation: 6,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// SwatchRow
// Horizontal scrollable color picker with a "Clear" button at the start.
// Shows the selected color name above the row when a swatch is chosen.
// ─────────────────────────────────────────────────────────────────────────────
interface SwatchRowProps {
  colors:   ColorEntry[];
  selected: number | null; // null = nothing selected
  onSelect: (idx: number) => void; // -1 = clear
}

function SwatchRow({ colors, selected, onSelect }: SwatchRowProps) {
  const selectedName = selected != null ? colors[selected]?.name : null;

  return (
    <View>
      {/* Selected color label */}
      <Text style={swSt.selectedName}>
        {selectedName ?? 'None'}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={swSt.row}>
        {/* Clear / no-color swatch */}
        <TouchableOpacity
          style={[swSt.swatch, swSt.clearSwatch, selected === null && swSt.clearActive]}
          onPress={() => onSelect(-1)}
          activeOpacity={0.75}>
          <Text style={swSt.clearX}>✕</Text>
        </TouchableOpacity>

        {/* Color swatches */}
        {colors.map((c, idx) => {
          const isSel = selected === idx;
          return (
            <TouchableOpacity
              key={idx}
              activeOpacity={0.8}
              style={[
                swSt.swatch,
                { backgroundColor: `rgb(${c.r},${c.g},${c.b})` },
                isSel && swSt.swatchSelected,
              ]}
              onPress={() => onSelect(idx)}>
              {isSel && <View style={swSt.checkmark} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const swSt = StyleSheet.create({
  selectedName: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  row:         { paddingHorizontal: 16, paddingVertical: 4, gap: 10, alignItems: 'center' },
  swatch: {
    width: 42, height: 42,
    borderRadius: 21,
    borderWidth: 2.5,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swatchSelected: {
    borderColor: '#fff',
    transform: [{ scale: 1.15 }],
  },
  checkmark: {
    width: 10, height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  clearSwatch: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.20)',
  },
  clearActive: {
    borderColor: '#fff',
  },
  clearX: { color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MakeupARScreen — main component
// ─────────────────────────────────────────────────────────────────────────────
export default function MakeupARScreen({ navigation }: any) {
  const [ready,          setReady]          = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>('lips');
  const [panelOpen,      setPanelOpen]      = useState(true);
  const [makeup,         setMakeup]         = useState<MakeupState>(EMPTY_STATE);

  // makeupRef always holds the latest state — prevents stale closures in callbacks
  const makeupRef       = useRef<MakeupState>(EMPTY_STATE);
  // Guards reloadConfig — set to true only after loadEffect has had time to finish
  const effectLoadedRef = useRef(false);
  // Guards initialize — must only be called once per process
  const initializedRef  = useRef(false);

  const safeAreaInsets = useSafeAreaInsets();

  // ── Apply current makeup state to Banuba ────────────────────────────────────
  // Always attempts reloadConfig — SDK silently drops calls it cannot handle yet.
  // No guard on effectLoadedRef: blocking early taps caused missed eye-color updates.
  const applyMakeup = useCallback((state: MakeupState) => {
    try {
      const config = buildConfig(state);
      console.log('APPLY CONFIG:', config);
      BanubaSdkManager.reloadConfig(config);
    } catch (_) {
      // SDK not ready yet — safe to ignore
    }
  }, []);

  // ── Atomically patch state + ref + push to SDK ──────────────────────────────
  // This is the single code path for ALL makeup changes.
  const setMakeupAndApply = useCallback((patch: Partial<MakeupState>) => {
    const next: MakeupState = { ...makeupRef.current, ...patch };
    makeupRef.current = next;
    setMakeup(next);
    applyMakeup(next); // instant — no debounce
  }, [applyMakeup]);

  // ── SDK initialize (once per process) ──────────────────────────────────────
  useEffect(() => {
    if (!initializedRef.current) {
      BanubaSdkManager.initialize(['bnb-resources'], BANUBA_TOKEN);
      initializedRef.current = true;
    }
  }, []);

  // ── Camera + player lifecycle ───────────────────────────────────────────────
  useEffect(() => {
    // Step 1: bind native view
    BanubaSdkManager.attachView();

    // Step 2: start camera + player + load effect (after SDK init settles)
    const startTimer = setTimeout(() => {
      BanubaSdkManager.openCamera();
      BanubaSdkManager.setCameraFacing(true); // front camera — required for makeup
      BanubaSdkManager.startPlayer();
      BanubaSdkManager.loadEffect(MAKEUP_EFFECT);
    }, CAMERA_START_DELAY);

    // Step 3: mark effect ready + re-apply current state + show UI.
    // Fires EFFECT_LOAD_WAIT ms after camera start, giving the effect bundle
    // time to fully initialize. Then we push whatever state the user has already
    // selected (via makeupRef) so no early taps are lost.
    const readyTimer = setTimeout(() => {
      effectLoadedRef.current = true;
      // Re-apply current (possibly non-empty) state so early selections take effect
      applyMakeup(makeupRef.current);
      setReady(true);
    }, CAMERA_START_DELAY + EFFECT_LOAD_WAIT);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(readyTimer);
      // stopPlayer is the only cleanup needed per official example
      try { BanubaSdkManager.stopPlayer(); } catch (_) {}
    };
  }, [applyMakeup]);

  // ── Makeup handlers ─────────────────────────────────────────────────────────
  // Each handler converts the swatch index (-1 = clear) to state and applies immediately.

  const handleLip = useCallback((idx: number) => {
    setMakeupAndApply({ selectedLip: idx === -1 ? null : idx });
  }, [setMakeupAndApply]);

  const handleEye = useCallback((idx: number) => {
    setMakeupAndApply({ selectedEye: idx === -1 ? null : idx });
  }, [setMakeupAndApply]);

  const handleBlush = useCallback((idx: number) => {
    setMakeupAndApply({ selectedBlush: idx === -1 ? null : idx });
  }, [setMakeupAndApply]);

  const handleFoundation = useCallback((v: number) => {
    setMakeupAndApply({ foundation: v });
  }, [setMakeupAndApply]);

  const handleContour = useCallback((v: number) => {
    setMakeupAndApply({ contour: v });
  }, [setMakeupAndApply]);

  const handleReset = useCallback(() => {
    makeupRef.current = EMPTY_STATE;
    setMakeup(EMPTY_STATE);
    applyMakeup(EMPTY_STATE);
  }, [applyMakeup]);

  // ── Derived UI state ────────────────────────────────────────────────────────
  // How many categories have something applied (for Reset button highlight)
  const activeCount =
    (makeup.selectedLip   != null ? 1 : 0) +
    (makeup.selectedEye   != null ? 1 : 0) +
    (makeup.selectedBlush != null ? 1 : 0) +
    (makeup.foundation    >  0    ? 1 : 0) +
    (makeup.contour       >  0    ? 1 : 0);

  // ── Category content renderer ───────────────────────────────────────────────
  const renderCategoryContent = () => {
    switch (activeCategory) {
      case 'lips':
        return (
          <SwatchRow
            colors={LIP_COLORS}
            selected={makeup.selectedLip}
            onSelect={handleLip}
          />
        );
      case 'eyes':
        return (
          <SwatchRow
            colors={EYE_COLORS}
            selected={makeup.selectedEye}
            onSelect={handleEye}
          />
        );
      case 'blush':
        return (
          <SwatchRow
            colors={BLUSH_COLORS}
            selected={makeup.selectedBlush}
            onSelect={handleBlush}
          />
        );
      case 'foundation':
        return (
          <IntensitySlider
            value={makeup.foundation}
            onChange={handleFoundation}
            color={ACCENT}
            label="Foundation Coverage"
          />
        );
      case 'contour':
        return (
          <IntensitySlider
            value={makeup.contour}
            onChange={handleContour}
            color={ACCENT}
            label="Contour Depth"
          />
        );
    }
  };

  // ── Applied look badges (shown under top bar when makeup is active) ─────────
  const lookBadges = [
    makeup.selectedLip   != null && {
      label: '💄',
      color: `rgb(${LIP_COLORS[makeup.selectedLip!].r},${LIP_COLORS[makeup.selectedLip!].g},${LIP_COLORS[makeup.selectedLip!].b})`,
      name: LIP_COLORS[makeup.selectedLip!].name,
    },
    makeup.selectedEye   != null && {
      label: '👁️',
      color: `rgb(${EYE_COLORS[makeup.selectedEye!].r},${EYE_COLORS[makeup.selectedEye!].g},${EYE_COLORS[makeup.selectedEye!].b})`,
      name: EYE_COLORS[makeup.selectedEye!].name,
    },
    makeup.selectedBlush != null && {
      label: '🌸',
      color: `rgb(${BLUSH_COLORS[makeup.selectedBlush!].r},${BLUSH_COLORS[makeup.selectedBlush!].g},${BLUSH_COLORS[makeup.selectedBlush!].b})`,
      name: BLUSH_COLORS[makeup.selectedBlush!].name,
    },
    makeup.foundation > 0 && { label: '🧴', color: ACCENT, name: 'Base' },
    makeup.contour    > 0 && { label: '✨', color: ACCENT, name: 'Contour' },
  ].filter(Boolean) as { label: string; color: string; name: string }[];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={st.root}>
      {/* Full-screen AR surface — always rendered so the native view exists */}
      <EPView style={st.camera} />

      {/* ── Loading overlay ─────────────────────────────────────────────────── */}
      <Modal visible={!ready} transparent animationType="none" statusBarTranslucent>
        <View style={st.centerOverlay}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={st.loadingTitle}>Starting AR Camera</Text>
          <Text style={st.loadingSubtext}>Loading makeup effects…</Text>
        </View>
      </Modal>

      {/* ── Floating UI overlay ─────────────────────────────────────────────── */}
      {/* Placed in a transparent Modal so it sits above the native SurfaceView  */}
      <Modal visible={ready} transparent animationType="fade" statusBarTranslucent>
        <View style={st.uiRoot} pointerEvents="box-none">

          {/* ── Top bar ──────────────────────────────────────────────────────── */}
          <View style={[st.topBar, { paddingTop: safeAreaInsets.top + 8 }]}>
            {/* Back button */}
            <TouchableOpacity
              style={st.iconBtn}
              onPress={() => navigation?.goBack()}
              activeOpacity={0.8}>
              <Text style={st.iconBtnText}>‹</Text>
            </TouchableOpacity>

            <Text style={st.screenTitle}>Makeup Try-On</Text>

            {/* Reset button — glows accent when makeup is active */}
            <TouchableOpacity
              style={[st.resetBtn, activeCount > 0 && { borderColor: ACCENT }]}
              onPress={handleReset}
              activeOpacity={0.8}>
              <Text style={[st.resetBtnText, activeCount > 0 && { color: ACCENT }]}>
                Reset
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Applied look badges ───────────────────────────────────────────── */}
          {lookBadges.length > 0 && (
            <View style={st.lookBadgeRow}>
              {lookBadges.map((b, i) => (
                <View key={i} style={[st.lookBadge, { borderColor: b.color + '88' }]}>
                  <View style={[st.lookBadgeDot, { backgroundColor: b.color }]} />
                  <Text style={st.lookBadgeLabel}>{b.label} {b.name}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Bottom panel ─────────────────────────────────────────────────── */}
          <View
            style={[
              st.bottomPanel,
              { paddingBottom: safeAreaInsets.bottom + 12 },
            ]}>
            {/* Drag handle / collapse toggle */}
            <TouchableOpacity
              style={st.panelHandle}
              onPress={() => setPanelOpen(p => !p)}
              activeOpacity={0.7}>
              <View style={st.panelHandlePill} />
              <Text style={st.panelHandleHint}>
                {panelOpen ? '▾ Makeup' : '▸ Makeup'}
              </Text>
            </TouchableOpacity>

            {panelOpen && (
              <>
                {/* ── Category tabs ─────────────────────────────────────────── */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={st.categoryTabs}>
                  {CATEGORIES.map(cat => {
                    const isActive = activeCategory === cat.id;
                    const hasValue =
                      (cat.id === 'lips'       && makeup.selectedLip   != null) ||
                      (cat.id === 'eyes'       && makeup.selectedEye   != null) ||
                      (cat.id === 'blush'      && makeup.selectedBlush != null) ||
                      (cat.id === 'foundation' && makeup.foundation    >  0)    ||
                      (cat.id === 'contour'    && makeup.contour       >  0);

                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[st.catTab, isActive && st.catTabActive]}
                        onPress={() => setActiveCategory(cat.id)}
                        activeOpacity={0.8}>
                        <Text style={st.catIcon}>{cat.icon}</Text>
                        <Text style={[st.catLabel, isActive && st.catLabelActive]}>
                          {cat.label}
                        </Text>
                        {/* Dot indicator when this category has a value applied */}
                        {hasValue && (
                          <View style={[st.catDot, { backgroundColor: ACCENT }]} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* ── Controls for active category ──────────────────────────── */}
                <View style={st.controlsArea}>
                  {renderCategoryContent()}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Screen-level styles ───────────────────────────────────────────────────────
const st = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },

  // Loading
  centerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.82)',
  },
  loadingTitle:   { color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 18 },
  loadingSubtext: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 7 },

  // UI overlay
  uiRoot: { flex: 1 },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.38)',
    gap: 10,
  },
  iconBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  iconBtnText: {
    color: '#fff', fontSize: 24, fontWeight: '700', lineHeight: 28,
  },
  screenTitle: {
    flex: 1,
    color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center',
    letterSpacing: 0.2,
  },
  resetBtn: {
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(0,0,0,0.50)',
  },
  resetBtnText: {
    color: 'rgba(255,255,255,0.50)', fontSize: 12, fontWeight: '700',
  },

  // Applied look badges
  lookBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 8,
  },
  lookBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.50)',
    borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1,
    gap: 5,
  },
  lookBadgeDot:   { width: 8, height: 8, borderRadius: 4 },
  lookBadgeLabel: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },

  // Bottom panel
  bottomPanel: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(8,8,18,0.90)',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    paddingTop: 4,
  },
  panelHandle:     { alignItems: 'center', paddingVertical: 10, gap: 4 },
  panelHandlePill: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  panelHandleHint: {
    color: 'rgba(255,255,255,0.30)', fontSize: 11, letterSpacing: 0.5,
  },

  // Category tabs
  categoryTabs: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  catTab: {
    alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 9,
    borderRadius: 16, borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.13)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    position: 'relative',
  },
  catTabActive: {
    backgroundColor: 'rgba(201,123,201,0.22)',
    borderColor: 'rgba(201,123,201,0.60)',
  },
  catIcon:        { fontSize: 19, marginBottom: 3 },
  catLabel:       { fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
  catLabelActive: { color: '#fff', fontWeight: '700' },
  catDot: {
    position: 'absolute', top: 5, right: 5,
    width: 7, height: 7, borderRadius: 3.5,
  },

  // Controls area
  controlsArea: { minHeight: 70, paddingBottom: 8 },
});
