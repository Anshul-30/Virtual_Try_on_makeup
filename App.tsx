import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import BanubaSdkManager, { EffectPlayerView } from '@banuba/react-native';

const EPView = EffectPlayerView as any;

const BANUBA_TOKEN =
  'Qk5CIDt9YdkduWc7sDISTNlPVTv0sSKF9kqb1cC46j6YSWrE/+m5lshR9PXNCgjEgv2FpREga4yqUXgJmnT7HJSfdUoAYvb36k1eWZftpuGqysZ/SQSqZ8F+6++lxMUWd03KQaWQjGGFbJ1SgB2sX3tMyu8XZTZP5MjJZ3HMghk/enKTNzY7LwwDr7zyuAyZuN9eoc4guX/nU+XMkKDmvZgo3DUDEJtoIldlCogbUcIwhu04EaoGZ5sGib3fS2zGSp5EbRfCVNu+W0ZjtUlui+dB/pRPe77bAHjApDOrg/E5neYXih1pqfyiPZNhLOPCb+qvYg4H8pqn9nSset92XiH7c9UYUKbtOiozqvSgmN1YJSfR2EPf92zagTPgGj7o1ITyxyS3QFhsJl7/SzjAXleLzGNcalV7jdNFN0Yfi7k25At4QOIimZHph9AHtAGIvHuqBu1/4hQUPrvCwJcNgbD08T2dxhaG082KuShSS1EmcnlNUNLxfDp1axhVDpjUk+4Zj3MUfhjXv093MCeJmITHOIuUKdD1imazWZUaVEqY7Z9lsiV38NN094C9XNA3LFiUkB/nIze/g7KfaZxRWTyzTdbYM4pAW6TEZO1tZ1fy+7BKVulJSWNu2wXnX1QtBr2kL8yHGG34aBtDAAvSdbg=';

const PRODUCT_KINDS = [
  'LIPSTICK',
  'EYESHADOW',
  'MASCARA',
  'BLUSH',
  'FOUNDATION',
  'EYEBROWS',
  'HIGHLIGHTER',
  'CONTOUR',
  'CONCEALER',
  'LIPSSHINE',
];

const PRODUCT_TO_REGION: any = {
  EYESHADOW: 'eyeshadow',
  MASCARA: 'eyelashes',
  BLUSH: 'blush',
  FOUNDATION: 'foundation',
  LIPSTICK: 'lipstick',
  EYEBROWS: 'eyebrows',
  HIGHLIGHTER: 'highlighter',
  CONTOUR: 'contour',
  CONCEALER: 'concealer',
  LIPSSHINE: 'lipsshine',
};

const REGION_TO_FINISHES: any = {
  blush: ['matte', 'shimmer', 'cream_shine'],
  concealer: ['natural', 'matte'],
  contour: ['normal'],
  eyebrows: ['matte', 'wet', 'clear'],
  eyelashes: ['natural', 'volume', 'lengthening'],
  eyeshadow: ['matte', 'shimmer', 'metallic', 'glitter'],
  foundation: ['natural', 'matte', 'radiance'],
  highlighter: ['shimmer'],
  lipstick: ['matte_cream', 'satin', 'shine', 'balm', 'shimmer'],
  lipsshine: ['shine', 'glitter'],
};

const REGION_COLORS: any = {
  lipstick: ['#b7485e', '#c14762', '#a8424e', '#d56970', '#9e3a52', '#7e2f3f'],
  eyeshadow: ['#8c6755', '#b28a74', '#8a5d7c', '#6d6b95', '#8f6a57', '#3b2f2f'],
  eyelashes: ['#1f1f1f', '#3a2f2b', '#523c34'],
  blush: ['#d17d86', '#cb8f87', '#c97d73', '#b86f6a'],
  foundation: ['#f1ceb6', '#deb193', '#c99675', '#aa7d5f', '#8a624a'],
  eyebrows: ['#322924', '#4f3b31', '#6f5043'],
  highlighter: ['#f2d7b0', '#ead0ad', '#f1d5c2'],
  contour: ['#8f6a55', '#7e5c49', '#6f5040'],
  concealer: ['#f0ccb4', '#dbb496', '#c79b7f'],
  lipsshine: ['#da7188', '#d46f6f', '#ce7998', '#c1587e'],
};

const COVERAGE_OPTIONS = [0.25, 0.5, 0.75, 1];
const MAKEUP_EFFECT_PATH = 'effects/Makeup';

function buildMakeupConfig(product: any, color: any, finish: any, coverage: any) {
  const region = PRODUCT_TO_REGION[product];
  const key = `makeup_${region}`;
  const faces0: any = {
    makeup_base: {
      mode: 'quality',
      smooth: '0 0',
    },
  };

  if (region === 'eyeshadow') {
    faces0[key] = [{ color, finish, coverage }];
  } else {
    faces0[key] = { color, finish, coverage };
  }

  return JSON.stringify({
    version: '2.0.0',
    scene: 'beauty_demo',
    camera: {},
    faces: [faces0],
  });
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('LIPSTICK');
  const [selectedFinish, setSelectedFinish] = useState('matte_cream');
  const [selectedColor, setSelectedColor] = useState('#b7485e');
  const [selectedCoverage, setSelectedCoverage] = useState(0.75);
  const initializedRef = useRef(false);
  const startedRef = useRef(false);
  const effectLoadedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    BanubaSdkManager.initialize(['bnb-resources'], BANUBA_TOKEN);
    initializedRef.current = true;
  }, []);

  useEffect(() => {
    return () => {
      try {
        BanubaSdkManager.stopPlayer();
      } catch (_) {}
    };
  }, []);

  const applyMakeup = useCallback(
    (product: any, finish: any, color: any, coverage: any) => {
      if (!startedRef.current || !effectLoadedRef.current) {
        return;
      }

      try {
        BanubaSdkManager.reloadConfig(
          buildMakeupConfig(product, color, finish, coverage),
        );
        setError('');
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Could not apply makeup';
        setError(message);
      }
    },
    [],
  );

  const startCamera = useCallback(() => {
    if (startedRef.current || !initializedRef.current) {
      return;
    }

    try {
      BanubaSdkManager.attachView();
      BanubaSdkManager.openCamera();
      BanubaSdkManager.setCameraFacing(true);
      BanubaSdkManager.startPlayer();
      BanubaSdkManager.loadEffect(MAKEUP_EFFECT_PATH);
      effectLoadedRef.current = false;
      setTimeout(() => {
        effectLoadedRef.current = true;
        applyMakeup(
          selectedProduct,
          selectedFinish,
          selectedColor,
          selectedCoverage,
        );
      }, 550);
      startedRef.current = true;
      setReady(true);
      setError('');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Banuba startup failed';
      setError(message);
    }
  }, [applyMakeup, selectedColor, selectedCoverage, selectedFinish, selectedProduct]);

  const region = PRODUCT_TO_REGION[selectedProduct];
  const finishes = REGION_TO_FINISHES[region] || [];
  const colors = REGION_COLORS[region] || REGION_COLORS.lipstick;

  const onPickProduct = (product: any) => {
    const nextRegion = PRODUCT_TO_REGION[product];
    const nextFinish = (REGION_TO_FINISHES[nextRegion] || ['matte'])[0];
    const nextColor = (REGION_COLORS[nextRegion] || REGION_COLORS.lipstick)[0];
    setSelectedProduct(product);
    setSelectedFinish(nextFinish);
    setSelectedColor(nextColor);
    applyMakeup(product, nextFinish, nextColor, selectedCoverage);
  };

  const onPickFinish = (finish: any) => {
    setSelectedFinish(finish);
    applyMakeup(selectedProduct, finish, selectedColor, selectedCoverage);
  };

  const onPickColor = (color: any) => {
    setSelectedColor(color);
    applyMakeup(selectedProduct, selectedFinish, color, selectedCoverage);
  };

  const onPickCoverage = (coverage: any) => {
    setSelectedCoverage(coverage);
    applyMakeup(selectedProduct, selectedFinish, selectedColor, coverage);
  };

  return (
    <View style={styles.root}>
      <EPView style={styles.camera} onLayout={startCamera} />

      {!ready && (
        <View style={styles.overlay}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.label}>Starting AR camera...</Text>
        </View>
      )}

      {error.length > 0 && (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {ready && (
        <View style={styles.bottomBar}>
          <Text style={styles.sectionTitle}>Makeup</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {PRODUCT_KINDS.map(product => {
              const active = selectedProduct === product;
              return (
                <TouchableOpacity
                  key={product}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => onPickProduct(product)}
                  activeOpacity={0.85}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {product}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {finishes.map((finish: any) => {
              const active = selectedFinish === finish;
              return (
                <TouchableOpacity
                  key={finish}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => onPickFinish(finish)}
                  activeOpacity={0.85}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {finish}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {colors.map((color: any) => {
              const active = selectedColor === color;
              return (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color },
                    active && styles.colorSwatchActive,
                  ]}
                  onPress={() => onPickColor(color)}
                  activeOpacity={0.9}
                />
              );
            })}
          </ScrollView>

          <View style={styles.row}>
            {COVERAGE_OPTIONS.map(level => {
              const active = selectedCoverage === level;
              return (
                <TouchableOpacity
                  key={level}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => onPickCoverage(level)}
                  activeOpacity={0.85}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {Math.round(level * 100)}%
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  label: {
    color: '#fff',
    fontSize: 14,
    marginTop: 10,
  },
  errorWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 24,
    backgroundColor: 'rgba(165,35,35,0.9)',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    color: '#fff',
    fontSize: 12,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 20,
    paddingTop: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    marginHorizontal: 12,
  },
  row: {
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  chipActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  chipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#000',
  },
  colorSwatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  colorSwatchActive: {
    borderColor: '#fff',
    transform: [{ scale: 1.1 }],
  },
});
