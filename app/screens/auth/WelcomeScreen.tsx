import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from '../../../components/ui';
import { theme } from '../../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';

const { width, height } = Dimensions.get('window');

export const WelcomeScreen: React.FC<any> = ({ navigation }) => {
  const { isAuthenticated, isLoading, loginAsGuest } = useAuth();

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;

  // Floating animation refs
  const float1 = useRef(new Animated.Value(0)).current;
  const float2 = useRef(new Animated.Value(0)).current;
  const float3 = useRef(new Animated.Value(0)).current;
  const float4 = useRef(new Animated.Value(0)).current;

  // Arrow animation
  const arrowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigation.replace('MainTabs');
      return;
    }

    // Main content animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 10,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.timing(logoRotate, {
        toValue: 1,
        duration: 1500,
        easing: Easing.elastic(1.2),
        useNativeDriver: true,
      }),
    ]).start();

    // Floating elements animation
    const createFloatAnimation = (anim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 3000 + delay,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 3000 + delay,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    createFloatAnimation(float1, 0);
    createFloatAnimation(float2, 500);
    createFloatAnimation(float3, 1000);
    createFloatAnimation(float4, 1500);
  }, [isAuthenticated, isLoading]);

  // Arrow press animation function
  const animateArrow = () => {
    Animated.sequence([
      Animated.timing(arrowAnim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(arrowAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const AnimatedArrow = () => (
    <Animated.View
      style={{
        transform: [{ scale: arrowScale }],
        opacity: arrowOpacity,
      }}
    >
      <Ionicons name="chevron-forward" size={24} color={theme.colors.textPrimary} />
    </Animated.View>
  );

  const handleGuestLogin = async () => {
    await loginAsGuest();
  };

  const handleGetStarted = () => {
    animateArrow();
    // Small delay to let animation play before navigation
    setTimeout(() => {
      navigation.navigate('Register');
    }, 150);
  };

  const rotate = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const arrowScale = arrowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.2],
  });

  const arrowOpacity = arrowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  const floatTranslate1 = float1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20],
  });

  const floatTranslate2 = float2.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -15],
  });

  const floatTranslate3 = float3.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 25],
  });

  const floatTranslate4 = float4.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });

  if (isLoading) {
    return (
      <LinearGradient
        colors={theme.colors.gradientBackground as [string, string]}
        style={styles.container}
      >
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <Animated.View
            style={[
              styles.loadingSpinner,
              {
                transform: [{ rotate }, { scale: logoScale }],
              },
            ]}
          >
            <Ionicons name="leaf" size={40} color={theme.colors.accent} />
          </Animated.View>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={theme.colors.gradientBackground as [string, string]}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />

      {/* Floating Background Elements */}
      <View style={styles.floatingContainer}>
        <Animated.View
          style={[
            styles.floatingElement,
            styles.floating1,
            { transform: [{ translateY: floatTranslate1 }] },
          ]}
        >
          <Ionicons name="leaf" size={24} color={theme.colors.accent} />
        </Animated.View>
        <Animated.View
          style={[
            styles.floatingElement,
            styles.floating2,
            { transform: [{ translateY: floatTranslate2 }] },
          ]}
        >
          <Ionicons name="flask" size={20} color={theme.colors.accentBlue} />
        </Animated.View>
        <Animated.View
          style={[
            styles.floatingElement,
            styles.floating3,
            { transform: [{ translateY: floatTranslate3 }] },
          ]}
        >
          <Ionicons name="shield-checkmark" size={22} color={theme.colors.success} />
        </Animated.View>
        <Animated.View
          style={[
            styles.floatingElement,
            styles.floating4,
            { transform: [{ translateY: floatTranslate4 }] },
          ]}
        >
          <Ionicons name="pulse" size={18} color={theme.colors.warning} />
        </Animated.View>
      </View>

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Hero Section */}
        <View style={styles.hero}>
          <Animated.View
            style={[
              styles.logoContainer,
              {
                transform: [{ scale: logoScale }, { rotate }],
              },
            ]}
          >
            <Image
              source={require('../../../assets/images/splash-icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>

          <View style={styles.heroText}>
            <Text style={styles.welcome}>Welcome to</Text>
            <Text style={styles.brand}>Vita Choice</Text>
            <Text style={styles.tagline}>
              Your personal supplement formula builder
            </Text>
            <Text style={styles.subtitle}>
              Create science-backed, compliant supplement formulas with confidence
            </Text>
          </View>
        </View>

        {/* Feature Highlights */}
        <View style={styles.features}>
          <View style={styles.featureRow}>
            <View style={styles.feature}>
              <View style={styles.featureIcon}>
                <Ionicons name="leaf" size={20} color={theme.colors.accent} />
              </View>
              <Text style={styles.featureText}>Natural Ingredients</Text>
            </View>
            <View style={styles.feature}>
              <View style={styles.featureIcon}>
                <Ionicons name="shield-checkmark" size={20} color={theme.colors.success} />
              </View>
              <Text style={styles.featureText}>Safety Verified</Text>
            </View>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.feature}>
              <View style={styles.featureIcon}>
                <Ionicons name="flask" size={20} color={theme.colors.accentBlue} />
              </View>
              <Text style={styles.featureText}>Science Based</Text>
            </View>
            <View style={styles.feature}>
              <View style={styles.featureIcon}>
                <Ionicons name="globe" size={20} color={theme.colors.warning} />
              </View>
              <Text style={styles.featureText}>Global Compliance</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            title="Get Started"
            variant="primary"
            size="large"
            fullWidth
            onPress={handleGetStarted}
            style={styles.primaryButton}
            rightIcon={<AnimatedArrow />}
          />

          <TouchableOpacity
            style={styles.guestButton}
            onPress={handleGuestLogin}
          >
            <Ionicons name="person-outline" size={18} color={theme.colors.textMuted} />
            <Text style={styles.guestText}>Continue as Guest</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.accent} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.signInText}>Already have an account? </Text>
            <Text style={styles.signInLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  floatingContainer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  floatingElement: {
    position: 'absolute',
    opacity: 0.6,
  },
  floating1: {
    top: height * 0.15,
    left: width * 0.1,
  },
  floating2: {
    top: height * 0.25,
    right: width * 0.15,
  },
  floating3: {
    top: height * 0.6,
    left: width * 0.2,
  },
  floating4: {
    top: height * 0.75,
    right: width * 0.1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.screenPadding,
    paddingTop: theme.spacing.xxxl,
    paddingBottom: theme.spacing.xxxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingSpinner: {
    marginBottom: theme.spacing.lg,
  },
  loadingText: {
    ...theme.getTextStyle('h4', 'medium'),
    color: theme.colors.textPrimary,
  },
  hero: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: theme.spacing.xl,
  },
  logo: {
    width: 120,
    height: 120,
  },
  heroText: {
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  welcome: {
    ...theme.getTextStyle('bodyLarge'),
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
  },
  brand: {
    ...theme.getTextStyle('h1', 'bold'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  tagline: {
    ...theme.getTextStyle('h3', 'medium'),
    color: theme.colors.accent,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
    maxWidth: 320,
  },
  subtitle: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textMuted,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 22,
  },
  features: {
    marginVertical: theme.spacing.xl,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.md,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: width * 0.35,
    justifyContent: 'center',
  },
  featureIcon: {
    marginRight: theme.spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(46,230,214,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    ...theme.getTextStyle('bodySmall', 'medium'),
    color: theme.colors.textPrimary,
  },
  actions: {
    width: '100%',
    alignItems: 'center',
  },
  primaryButton: {
    marginBottom: theme.spacing.md,
  },
  secondaryButton: {
    marginBottom: theme.spacing.xl,
  },
  guestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  guestText: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textMuted,
    marginHorizontal: theme.spacing.sm,
    flex: 1,
    textAlign: 'center',
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
  },
  signInText: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.textMuted,
  },
  signInLink: {
    ...theme.getTextStyle('bodySmall', 'medium'),
    color: theme.colors.accent,
  },
});

export default WelcomeScreen;
