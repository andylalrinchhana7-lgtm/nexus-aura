import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  StatusBar,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: W, height: H } = Dimensions.get("window");
const SLIDE_DURATION = 5000;

export interface StorySlide {
  imageUrl: string;
  caption?: string;
}

export interface StoryData {
  id: string;
  username: string;
  avatarColor: string;
  timestamp: string;
  slides: StorySlide[];
}

interface Props {
  stories: StoryData[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}

export function StoryViewer({ stories, initialIndex, visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [storyIdx, setStoryIdx] = useState(initialIndex);
  const [slideIdx, setSlideIdx] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  // Keep refs in sync for use inside animation callbacks
  const storyIdxRef = useRef(storyIdx);
  const slideIdxRef = useRef(slideIdx);
  useEffect(() => { storyIdxRef.current = storyIdx; }, [storyIdx]);
  useEffect(() => { slideIdxRef.current = slideIdx; }, [slideIdx]);

  const currentStory = stories[storyIdx];
  const slideCount = currentStory?.slides.length ?? 0;
  const currentSlide = currentStory?.slides[slideIdx];

  // ── Advance to next slide / story / close ──────────────────────────────
  const advance = () => {
    const si = storyIdxRef.current;
    const sli = slideIdxRef.current;
    const storySlideCount = stories[si]?.slides.length ?? 0;

    if (sli < storySlideCount - 1) {
      setSlideIdx(sli + 1);
    } else if (si < stories.length - 1) {
      setStoryIdx(si + 1);
      setSlideIdx(0);
    } else {
      onClose();
    }
  };

  // ── Go back one slide / story ──────────────────────────────────────────
  const goBack = () => {
    const si = storyIdxRef.current;
    const sli = slideIdxRef.current;

    if (sli > 0) {
      setSlideIdx(sli - 1);
    } else if (si > 0) {
      setStoryIdx(si - 1);
      setSlideIdx(stories[si - 1]!.slides.length - 1);
    }
  };

  // ── Start / restart progress bar animation ─────────────────────────────
  useEffect(() => {
    if (!visible) return;

    progressAnim.setValue(0);
    animRef.current?.stop();
    animRef.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: SLIDE_DURATION,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished) advance();
    });

    return () => animRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, storyIdx, slideIdx]);

  // Reset to initial when reopened
  useEffect(() => {
    if (visible) {
      setStoryIdx(initialIndex);
      setSlideIdx(0);
    }
  }, [visible, initialIndex]);

  if (!currentStory || !currentSlide) return null;

  const initials = currentStory.username.charAt(0).toUpperCase();

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {Platform.OS !== "web" && <StatusBar hidden />}
      <View style={styles.container}>
        {/* ── Background image ── */}
        <Image
          source={{ uri: currentSlide.imageUrl }}
          style={styles.bg}
          resizeMode="cover"
        />

        {/* ── Top gradient overlay ── */}
        <View style={styles.topGradient} />
        {/* ── Bottom gradient overlay ── */}
        <View style={styles.bottomGradient} />

        {/* ── Progress bars ── */}
        <View
          style={[
            styles.progressRow,
            { paddingTop: insets.top + (Platform.OS === "android" ? 28 : 12) },
          ]}
        >
          {Array.from({ length: slideCount }).map((_, i) => (
            <View key={i} style={[styles.progressTrack, { flex: 1 }]}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width:
                      i < slideIdx
                        ? "100%"
                        : i === slideIdx
                        ? progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ["0%", "100%"],
                          })
                        : "0%",
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* ── User header ── */}
        <View style={styles.userRow}>
          <View style={[styles.avatar, { backgroundColor: currentStory.avatarColor }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.userMeta}>
            <Text style={styles.username}>{currentStory.username}</Text>
            <Text style={styles.ts}>{currentStory.timestamp}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={16} style={styles.closeBtn}>
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ── Caption ── */}
        {currentSlide.caption ? (
          <View
            style={[
              styles.captionWrap,
              { paddingBottom: insets.bottom + 48 },
            ]}
          >
            <Text style={styles.caption}>{currentSlide.caption}</Text>
          </View>
        ) : null}

        {/* ── Touch zones (left = back, right = forward) ── */}
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <View style={styles.touchRow} pointerEvents="box-none">
            <TouchableWithoutFeedback onPress={goBack}>
              <View style={styles.touchZone} />
            </TouchableWithoutFeedback>
            <TouchableWithoutFeedback onPress={advance}>
              <View style={styles.touchZone} />
            </TouchableWithoutFeedback>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    width: W,
    height: H,
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 140,
    backgroundColor: "rgba(0,0,0,0.5)",
  },

  // ── Progress bars ──
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 4,
  },
  progressTrack: {
    height: 2.5,
    backgroundColor: "rgba(255,255,255,0.35)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 2,
  },

  // ── User header ──
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  userMeta: { flex: 1 },
  username: { color: "#fff", fontSize: 14, fontWeight: "700" },
  ts: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  closeBtn: { padding: 4 },

  // ── Caption ──
  captionWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  caption: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    lineHeight: 22,
  },

  // ── Touch zones ──
  touchRow: {
    flex: 1,
    flexDirection: "row",
    // push down below the header area (~120px)
    marginTop: 120,
  },
  touchZone: { flex: 1, height: "100%" },
});
