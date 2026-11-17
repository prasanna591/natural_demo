import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * Last-resort screen for unexpected render errors. Without this, a thrown
 * error unmounts the React tree and leaves Android on a blank window.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Naturals crashed while rendering", error, info.componentStack);
  }

  private retry = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.screen}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>NATURALS SALON</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            The app hit an unexpected problem. Your account and bookings are safe. Try again, or close and reopen
            Naturals if the problem continues.
          </Text>
          <Pressable accessibilityRole="button" onPress={this.retry} style={styles.button}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FAF7F3",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: "#E7DFEC",
  },
  eyebrow: {
    color: "#6B4A7E",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
  title: {
    color: "#2A1733",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 10,
  },
  body: {
    color: "#5C5262",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
  button: {
    marginTop: 22,
    alignSelf: "flex-start",
    backgroundColor: "#59276F",
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
