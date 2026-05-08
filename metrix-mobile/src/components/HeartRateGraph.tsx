import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import Animated, { 
  useSharedValue, 
  useAnimatedProps, 
  withTiming, 
  withRepeat, 
  withSequence,
  Easing,
  interpolate
} from 'react-native-reanimated';
import { useAppTheme } from '../context/ThemeContext';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface HeartRateGraphProps {
  bpm: number | null;
  history: number[];
}

export const HeartRateGraph: React.FC<HeartRateGraphProps> = ({ bpm, history }) => {
  const { currentThemeColors } = useAppTheme();
  const width = Dimensions.get('window').width / 2 - 40; // Approx width of the card half
  const height = 60;

  // Animation values for the ECG "pulse" effect
  const pulse = useSharedValue(0);

  // Calculate duration based on BPM (60,000ms / BPM)
  const duration = useMemo(() => {
    const rate = bpm || 70; // Fallback to 70 if null
    return 60000 / rate;
  }, [bpm]);

  useEffect(() => {
    pulse.value = 0;
    pulse.value = withRepeat(
      withTiming(1, { 
        duration: duration, 
        easing: Easing.linear 
      }),
      -1,
      false
    );
  }, [duration]);

  // Generate a path based on history or a default ECG wave if empty
  const pathData = useMemo(() => {
    if (history.length < 2) {
      // Default ECG-like path if no history
      return "M0,30 L20,30 L25,10 L30,50 L35,30 L55,30 L60,10 L65,50 L70,30 L100,30";
    }

    const max = Math.max(...history, 100);
    const min = Math.min(...history, 40);
    const range = max - min || 1;

    let d = `M0,${height - ((history[0] - min) / range) * (height - 20) - 10}`;
    const step = width / (history.length - 1);

    for (let i = 1; i < history.length; i++) {
      const x = i * step;
      const y = height - ((history[i] - min) / range) * (height - 20) - 10;
      d += ` L${x},${y}`;
    }
    return d;
  }, [history, width]);

  const animatedProps = useAnimatedProps(() => {
    // Opacity pulse effect synchronized with the beat
    const opacity = interpolate(
      pulse.value,
      [0, 0.1, 0.2, 0.5, 1],
      [0.3, 1, 0.3, 0.3, 0.3]
    );
    
    return {
      opacity: opacity
    };
  });

  return (
    <View style={styles.container}>
      <Svg height={height} width={width} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={currentThemeColors.primary} stopOpacity="0.4" />
            <Stop offset="1" stopColor={currentThemeColors.primary} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        
        {/* Shadow/Fill Area */}
        <Path
          d={`${pathData} L${width},${height} L0,${height} Z`}
          fill="url(#grad)"
        />

        {/* The Main Line */}
        <AnimatedPath
          d={pathData}
          stroke={currentThemeColors.primary}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          animatedProps={animatedProps}
        />
        
        {/* Pulse Indicator (ECG spike effect) */}
        <Animated.View style={styles.scanline} />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 60,
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  scanline: {
    position: 'absolute',
    height: '100%',
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
  }
});
