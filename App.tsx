import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  PanResponderGestureState,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import BanubaSdkManager, { EffectPlayerView } from '@banuba/react-native';

const EPView = EffectPlayerView as any;

// ── SDK token ─────────────────────────────────────────────────────────────────
const BANUBA_TOKEN =
  'Qk5CIDt9YdkduWc7sDISTNlPVTv0sSKF9kqb1cC46j6YSWrE/+m5lshR9PXNCgjEgv2FpREga4yqUXgJmnT7HJSfdUoAYvb36k1eWZftpuGqysZ/SQSqZ8F+6++lxMUWd03KQaWQjGGFbJ1SgB2sX3tMyu8XZTZP5MjJZ3HMghk/enKTNzY7LwwDr7zyuAyZuN9eoc4guX/nU+XMkKDmvZgo3DUDEJtoIldlCogbUcIwhu04EaoGZ5sGib3fS2zGSp5EbRfCVNu+W0ZjtUlui+dB/pRPe77bAHjApDOrg/E5neYXih1pqfyiPZNhLOPCb+qvYg4H8pqn9nSset92XiH7c9UYUKbtOiozqvSgmN1YJSfR2EPf92zagTPgGj7o1ITyxyS3QFhsJl7/SzjAXleLzGNcalV7jdNFN0Yfi7k25At4QOIimZHph9AHtAGIvHuqBu1/4hQUPrvCwJcNgbD08T2dxhaG082KuShSS1EmcnlNUNLxfDp1axhVDpjUk+4Zj3MUfhjXv093MCeJmITHOIuUKdD1imazWZUaVEqY7Z9lsiV38NN094C9XNA3LFiUkB/nIze/g7KfaZxRWTyzTdbYM4pAW6TEZO1tZ1fy+7BKVulJSWNu2wXnX1QtBr2kL8yHGG34aBtDAAvSdbg=';

// ── AR Effects ────────────────────────────────────────────────────────────────
const EFFECTS = [
  { id: 'Makeup', label: 'Natural' },
  { id: 'RainbowBeauty', label: 'Rainbow' },
  // { id: 'WhooshBeautyFemale', label: 'Glam' },
  // { id: 'relook', label: 'Relook' },
];

// ── Makeup categories ─────────────────────────────────────────────────────────
type Category = 'lips' | 'eyes' | 'blush' | 'foundation' | 'contour';

const CATEGORIES: { id: Category; icon: string; label: string }[] = [
  { id: 'lips', icon: '💄', label: 'Lips' },
  { id: 'eyes', icon: '👁️', label: 'Eyes' },
  { id: 'blush', icon: '🌸', label: 'Blush' },
  { id: 'foundation', icon: '🧴', label: 'Base' },
  { id: 'contour', icon: '✨', label: 'Contour' },
];

// ── Color palettes ────────────────────────────────────────────────────────────
type RGBA = { r: number; g: number; b: number; a: number };

const LIP_COLORS: RGBA[] = [
  { r: 200, g: 30, b: 30, a: 0.9 },  // classic red
  { r: 220, g: 80, b: 100, a: 0.85 }, // rose
  { r: 180, g: 60, b: 80, a: 0.9 },  // berry
  { r: 140, g: 30, b: 60, a: 0.9 },  // wine
  { r: 230, g: 120, b: 80, a: 0.8 },  // coral
  { r: 210, g: 150, b: 130, a: 0.75 }, // nude
  { r: 190, g: 90, b: 110, a: 0.85 }, // dusty rose
  { r: 100, g: 20, b: 50, a: 0.9 },  // plum
];

const EYE_COLORS: RGBA[] = [
  { r: 60, g: 50, b: 50, a: 0.8 },  // smoky black
  { r: 180, g: 120, b: 60, a: 0.7 },  // bronze
  { r: 200, g: 160, b: 60, a: 0.7 },  // gold
  { r: 80, g: 100, b: 180, a: 0.7 },  // blue
  { r: 140, g: 80, b: 160, a: 0.7 },  // violet
  { r: 80, g: 160, b: 100, a: 0.7 },  // emerald
  { r: 160, g: 100, b: 80, a: 0.65 }, // copper
  { r: 50, g: 50, b: 50, a: 0.6 },  // charcoal
];

const BLUSH_COLORS: RGBA[] = [
  { r: 255, g: 160, b: 160, a: 0.5 },  // soft pink
  { r: 255, g: 120, b: 100, a: 0.5 },  // peach
  { r: 220, g: 80, b: 100, a: 0.45 }, // rose blush
  { r: 200, g: 100, b: 80, a: 0.5 },  // coral blush
  { r: 240, g: 180, b: 140, a: 0.45 }, // natural
  { r: 180, g: 80, b: 120, a: 0.45 }, // berry blush
  { r: 255, g: 200, b: 160, a: 0.4 },  // champagne
  { r: 210, g: 120, b: 140, a: 0.5 },  // mauve
];

// ── evalJs helpers ────────────────────────────────────────────────────────────
const evalSafe = (js: string) => {
  try { BanubaSdkManager.evalJs(js); } catch (_) { }
};

const applyLipColor = (c: RGBA) => evalSafe(`lips.color(${c.r},${c.g},${c.b},${c.a})`);
const applyEyeColor = (c: RGBA) => evalSafe(`eyes.color(${c.r},${c.g},${c.b},${c.a})`);
const applyBlushColor = (c: RGBA) => evalSafe(`blush.color(${c.r},${c.g},${c.b},${c.a})`);
const applyFoundation = (v: number) => evalSafe(`Foundation.strength(${v.toFixed(2)})`);
const applyContour = (v: number) => evalSafe(`Contour.strength(${v.toFixed(2)})`);

const resetAllMakeup = () => {
  evalSafe('lips.color(0,0,0,0)');
  evalSafe('eyes.color(0,0,0,0)');
  evalSafe('blush.color(0,0,0,0)');
  evalSafe('Foundation.strength(0)');
  evalSafe('Contour.strength(0)');
};

// ── Intensity slider ──────────────────────────────────────────────────────────
interface SliderProps {
  value: number;                         // 0..1
  onChange: (v: number) => void;
  color: string;
  label: string;
}

function IntensitySlider({ value, onChange, color, label }: SliderProps) {
  const trackWidth = useRef(0);
  const currentValue = useRef(value);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        if (trackWidth.current > 0) {
          const x = e.nativeEvent.locationX;
          const clamped = Math.min(1, Math.max(0, x / trackWidth.current));
          currentValue.current = clamped;
          onChange(clamped);
        }
      },
      onPanResponderMove: (e: GestureResponderEvent, _g: PanResponderGestureState) => {
        if (trackWidth.current > 0) {
          const x = e.nativeEvent.locationX;
          const clamped = Math.min(1, Math.max(0, x / trackWidth.current));
          currentValue.current = clamped;
          onChange(clamped);
        }
      },
    }),
  ).current;

  const handleLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  };

  return (
    <View style={sliderStyles.wrapper}>
      <Text style={sliderStyles.sliderLabel}>{label}</Text>
      <View style={sliderStyles.row}>
        <View
          style={sliderStyles.track}
          onLayout={handleLayout}
          {...panResponder.panHandlers}>
          {/* Filled portion */}
          <View
            style={[sliderStyles.filled, { width: `${value * 100}%`, backgroundColor: color }]}
          />
          {/* Thumb */}
          <View
            style={[
              sliderStyles.thumb,
              { left: `${value * 100}%`, borderColor: color },
            ]}
          />
        </View>
        <Text style={[sliderStyles.pct, { color }]}>{Math.round(value * 100)}%</Text>
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  wrapper: { paddingHorizontal: 20, paddingVertical: 10 },
  sliderLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  track: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3,
    position: 'relative',
    justifyContent: 'center',
  },
  filled: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3 },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 2,
    marginLeft: -10,
    top: -7,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  pct: { fontSize: 13, fontWeight: '700', minWidth: 36, textAlign: 'right' },
});

// ── Color swatch row ──────────────────────────────────────────────────────────
interface SwatchRowProps {
  colors: RGBA[];
  selected: number | null;
  onSelect: (idx: number) => void;
}

function SwatchRow({ colors, selected, onSelect }: SwatchRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={swatchStyles.row}>
      {/* Clear / Off swatch */}
      <TouchableOpacity
        style={[swatchStyles.swatch, swatchStyles.clearSwatch, selected === -1 && { borderColor: '#fff' }]}
        onPress={() => onSelect(-1)}>
        <Text style={swatchStyles.clearX}>✕</Text>
      </TouchableOpacity>

      {colors.map((c, idx) => {
        const isSel = selected === idx;
        return (
          <TouchableOpacity
            key={idx}
            style={[
              swatchStyles.swatch,
              { backgroundColor: `rgb(${c.r},${c.g},${c.b})` },
              isSel && { borderColor: '#fff', transform: [{ scale: 1.2 }] },
            ]}
            onPress={() => onSelect(idx)}>
            {isSel && <View style={swatchStyles.dot} />}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const swatchStyles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 4, gap: 10 },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearSwatch: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  clearX: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '700' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
});

// ── State shape ───────────────────────────────────────────────────────────────
interface MakeupState {
  selectedLip: number | null;
  selectedEye: number | null;
  selectedBlush: number | null;
  foundation: number;            // 0..1
  contour: number;            // 0..1
}

// ── Main component ────────────────────────────────────────────────────────────
export default function App({ navigation }: any) {
  const [ready, setReady] = useState(false);
  const [activeEffect, setActiveEffect] = useState('Makeup');
  const [activeCategory, setActiveCategory] = useState<Category>('lips');
  const [panelOpen, setPanelOpen] = useState(true);

  const [makeup, setMakeup] = useState<MakeupState>({
    selectedLip: null,
    selectedEye: null,
    selectedBlush: null,
    foundation: 0,
    contour: 0,
  });

  const initializedRef = useRef(false);
  const safeAreaInsets = 100;
  const ACCENT = '#c97bc9';  // soft violet neon — matches Aylla primary

  // ── SDK init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!initializedRef.current) {
      BanubaSdkManager.initialize(['bnb-resources'], BANUBA_TOKEN); // ✅
      initializedRef.current = true;
    }
  }, []);

  useEffect(() => {
    BanubaSdkManager.attachView();
    const startTimer = setTimeout(() => {
      BanubaSdkManager.openCamera();
      BanubaSdkManager.setCameraFacing(true);
      BanubaSdkManager.startPlayer();
      console.log('testtt')
      BanubaSdkManager.loadEffect('Makeup'); // ✅
      console.log('load effecttesttt')
    }, 600);
    const readyTimer = setTimeout(() => setReady(true), 2600);
    return () => {
      clearTimeout(startTimer);
      clearTimeout(readyTimer);
      try { BanubaSdkManager.stopPlayer(); } catch (_) { }
      try { BanubaSdkManager.closeCamera(); } catch (_) { }
      try { BanubaSdkManager.deinitialize(); } catch (_) { }
    };
  }, []);

  // ── Effect switch ───────────────────────────────────────────────────────────
  const switchEffect = (id: string) => {
    setActiveEffect(id);
    evalSafe(`BanubaPlugin.loadEffect('effects/${id}')`);
    try { BanubaSdkManager.loadEffect('effects/' + id); } catch (_) { }
  };

  // ── Makeup handlers ─────────────────────────────────────────────────────────
  const handleLip = useCallback((idx: number) => {
    if (idx === -1) {
      evalSafe('lips.color(0,0,0,0)');
      setMakeup(prev => ({ ...prev, selectedLip: null }));
    } else {
      applyLipColor(LIP_COLORS[idx]);
      setMakeup(prev => ({ ...prev, selectedLip: idx }));
    }
  }, []);

  const handleEye = useCallback((idx: number) => {
    if (idx === -1) {
      evalSafe('eyes.color(0,0,0,0)');
      setMakeup(prev => ({ ...prev, selectedEye: null }));
    } else {
      applyEyeColor(EYE_COLORS[idx]);
      setMakeup(prev => ({ ...prev, selectedEye: idx }));
    }
  }, []);

  const handleBlush = useCallback((idx: number) => {
    if (idx === -1) {
      evalSafe('blush.color(0,0,0,0)');
      setMakeup(prev => ({ ...prev, selectedBlush: null }));
    } else {
      applyBlushColor(BLUSH_COLORS[idx]);
      setMakeup(prev => ({ ...prev, selectedBlush: idx }));
    }
  }, []);

  const handleFoundation = useCallback((v: number) => {
    applyFoundation(v);
    setMakeup(prev => ({ ...prev, foundation: v }));
  }, []);

  const handleContour = useCallback((v: number) => {
    applyContour(v);
    setMakeup(prev => ({ ...prev, contour: v }));
  }, []);

  const handleReset = () => {
    resetAllMakeup();
    setMakeup({ selectedLip: null, selectedEye: null, selectedBlush: null, foundation: 0, contour: 0 });
  };

  // ── Category panel content ──────────────────────────────────────────────────
  const renderCategoryContent = () => {
    switch (activeCategory) {
      case 'lips':
        return (
          <SwatchRow
            colors={LIP_COLORS}
            selected={makeup.selectedLip ?? -99}
            onSelect={handleLip}
          />
        );
      case 'eyes':
        return (
          <SwatchRow
            colors={EYE_COLORS}
            selected={makeup.selectedEye ?? -99}
            onSelect={handleEye}
          />
        );
      case 'blush':
        return (
          <SwatchRow
            colors={BLUSH_COLORS}
            selected={makeup.selectedBlush ?? -99}
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

  // ── Active indicator dot count (how many categories have something applied) ─
  const activeCount =
    (makeup.selectedLip != null ? 1 : 0) +
    (makeup.selectedEye != null ? 1 : 0) +
    (makeup.selectedBlush != null ? 1 : 0) +
    (makeup.foundation > 0 ? 1 : 0) +
    (makeup.contour > 0 ? 1 : 0);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Full-screen AR surface */}
      <EPView style={styles.camera} onEffectLoaded={() => {
        console.log('✅ Effect loaded and ready');
        // setStage('ready'); // safe to call evalJs now
      }} />

      {/* Loading overlay */}
      <Modal visible={!ready} transparent animationType="none" statusBarTranslucent>
        <View style={styles.centerOverlay}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.loadingText}>Starting AR Camera...</Text>
          <Text style={styles.loadingSubtext}>Detecting face landmarks</Text>
        </View>
      </Modal>

      {/* Main AR UI — all in a Modal to float above SurfaceView */}
      <Modal visible={ready} transparent animationType="none" statusBarTranslucent>
        <View style={styles.uiRoot} pointerEvents="box-none">

          {/* ── Top bar ─────────────────────────────────────────── */}
          <View style={[styles.topBar, { paddingTop: safeAreaInsets.top + 8 }]}>
            {/* Back */}
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation?.goBack()}>
              <Text style={styles.iconBtnText}>{'‹'}</Text>
            </TouchableOpacity>

            {/* Effect chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.effectChips}>
              {EFFECTS.map(e => (
                <TouchableOpacity
                  key={e.id}
                  style={[styles.chip, activeEffect === e.id && styles.chipActive]}
                  onPress={() => switchEffect(e.id)}>
                  <Text style={[styles.chipText, activeEffect === e.id && styles.chipTextActive]}>
                    {e.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Reset button */}
            <TouchableOpacity
              style={[styles.iconBtn, styles.resetBtn, activeCount > 0 && { borderColor: ACCENT }]}
              onPress={handleReset}>
              <Text style={[styles.resetBtnText, activeCount > 0 && { color: ACCENT }]}>
                Reset
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Applied look indicators ──────────────────────────── */}
          {activeCount > 0 && (
            <View style={styles.lookBadgeRow}>
              {[
                makeup.selectedLip != null && { label: '💄', color: makeup.selectedLip != null ? `rgb(${LIP_COLORS[makeup.selectedLip!].r},${LIP_COLORS[makeup.selectedLip!].g},${LIP_COLORS[makeup.selectedLip!].b})` : '' },
                makeup.selectedEye != null && { label: '👁️', color: makeup.selectedEye != null ? `rgb(${EYE_COLORS[makeup.selectedEye!].r},${EYE_COLORS[makeup.selectedEye!].g},${EYE_COLORS[makeup.selectedEye!].b})` : '' },
                makeup.selectedBlush != null && { label: '🌸', color: makeup.selectedBlush != null ? `rgb(${BLUSH_COLORS[makeup.selectedBlush!].r},${BLUSH_COLORS[makeup.selectedBlush!].g},${BLUSH_COLORS[makeup.selectedBlush!].b})` : '' },
                makeup.foundation > 0 && { label: '🧴', color: ACCENT },
                makeup.contour > 0 && { label: '✨', color: ACCENT },
              ].filter(Boolean).map((b: any, i) => (
                <View key={i} style={[styles.lookBadge, { borderColor: b.color + '88' }]}>
                  <View style={[styles.lookBadgeDot, { backgroundColor: b.color }]} />
                  <Text style={styles.lookBadgeLabel}>{b.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Bottom panel ─────────────────────────────────────── */}
          <View style={[styles.bottomPanel, { paddingBottom: safeAreaInsets.bottom + 8 }]}>

            {/* Collapse / expand handle */}
            <TouchableOpacity style={styles.panelHandle} onPress={() => setPanelOpen(p => !p)}>
              <View style={styles.panelHandlePill} />
              <Text style={styles.panelHandleHint}>{panelOpen ? '▾ Makeup' : '▸ Makeup'}</Text>
            </TouchableOpacity>

            {panelOpen && (
              <>
                {/* Category tabs */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryTabs}>
                  {CATEGORIES.map(cat => {
                    const isActive = activeCategory === cat.id;
                    const hasValue =
                      (cat.id === 'lips' && makeup.selectedLip != null) ||
                      (cat.id === 'eyes' && makeup.selectedEye != null) ||
                      (cat.id === 'blush' && makeup.selectedBlush != null) ||
                      (cat.id === 'foundation' && makeup.foundation > 0) ||
                      (cat.id === 'contour' && makeup.contour > 0);

                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.catTab, isActive && styles.catTabActive]}
                        onPress={() => setActiveCategory(cat.id)}>
                        <Text style={styles.catIcon}>{cat.icon}</Text>
                        <Text style={[styles.catLabel, isActive && { color: '#fff' }]}>
                          {cat.label}
                        </Text>
                        {hasValue && <View style={[styles.catDot, { backgroundColor: ACCENT }]} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Category-specific controls */}
                <View style={styles.controlsArea}>
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

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', },
  camera: { flex: 1 },

  // Loading
  centerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  loadingText: { color: '#fff', fontSize: 16, marginTop: 16, fontWeight: '600' },
  loadingSubtext: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 6 },

  // Main UI wrapper
  uiRoot: { flex: 1 ,paddingTop:100},

  // ── Top bar ────────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  iconBtnText: { color: '#fff', fontSize: 22, fontWeight: '700', lineHeight: 26 },
  effectChips: { paddingVertical: 2, gap: 7 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  chipActive: { backgroundColor: '#fff', borderColor: '#fff' },
  chipText: { color: '#fff', fontSize: 13 },
  chipTextActive: { color: '#000', fontWeight: '700' },
  resetBtn: { paddingHorizontal: 12, width: 'auto' as any },
  resetBtnText: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600' },

  // ── Look badges ────────────────────────────────────────────────────────────
  lookBadgeRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  lookBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    gap: 4,
  },
  lookBadgeDot: { width: 8, height: 8, borderRadius: 4 },
  lookBadgeLabel: { fontSize: 12, color: '#fff' },

  // ── Bottom panel ───────────────────────────────────────────────────────────
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10,10,20,0.88)',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingTop: 8,
  },
  panelHandle: { alignItems: 'center', paddingVertical: 8, gap: 4 },
  panelHandlePill: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  panelHandleHint: { color: 'rgba(255,255,255,0.35)', fontSize: 11, letterSpacing: 0.5 },

  // Category tabs
  categoryTabs: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
  },
  catTab: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    position: 'relative',
  },
  catTabActive: {
    backgroundColor: 'rgba(201,123,201,0.25)',
    borderColor: 'rgba(201,123,201,0.6)',
  },
  catIcon: { fontSize: 18, marginBottom: 3 },
  catLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  catDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Controls area (swatches or slider)
  controlsArea: {
    minHeight: 64,
    paddingBottom: 4,
  },
});
