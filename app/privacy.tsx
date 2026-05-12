import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../src/constants/design';

const LAST_UPDATED = 'April 21, 2026';
const CONTACT_EMAIL = 'snurfedllc@gmail.com';
const COMPANY_NAME = 'Snurfed LLC';

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.lastUpdated}>Last Updated: {LAST_UPDATED}</Text>

        <Text style={styles.intro}>
          {COMPANY_NAME} ("we," "our," or "us") operates the Genkochi mobile application (the "App").
          This Privacy Policy explains how we collect, use, disclose, and safeguard your information
          when you use our App.
        </Text>

        <Section title="1. Information We Collect">
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Photos and Images:</Text> When you use the App to learn vocabulary,
            you may take photos or select images from your device. These images are processed to identify
            objects and generate vocabulary. Images are sent to our AI service provider (OpenAI) for
            analysis but are not permanently stored on our servers.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Voice Data:</Text> If you use speech practice features, your voice
            recordings are processed locally on your device for pronunciation feedback. Voice data is not
            transmitted to external servers.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Location Data:</Text> With your permission, we may collect your
            approximate location to tag vocabulary with where you learned it. This data is stored locally
            on your device.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Usage Data:</Text> We collect anonymous usage statistics to improve
            the App, including features used, learning progress, and app performance metrics.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Account Information:</Text> If you subscribe to premium features,
            we collect your email address and payment information through our payment processor (RevenueCat/Apple/Google).
          </Text>
        </Section>

        <Section title="2. How We Use Your Information">
          <Text style={styles.paragraph}>We use the information we collect to:</Text>
          <BulletPoint text="Provide and maintain the App's language learning features" />
          <BulletPoint text="Process your photos to generate vocabulary and sentences" />
          <BulletPoint text="Track your learning progress and provide personalized recommendations" />
          <BulletPoint text="Process payments and manage subscriptions" />
          <BulletPoint text="Improve and optimize the App's performance" />
          <BulletPoint text="Communicate with you about updates and support" />
        </Section>

        <Section title="3. Third-Party Services">
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>OpenAI:</Text> We use OpenAI's API to analyze images and generate
            vocabulary. Images you submit are processed according to OpenAI's privacy policy. OpenAI does
            not use data submitted via API to train their models.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>RevenueCat:</Text> We use RevenueCat to manage subscriptions.
            RevenueCat processes payment information according to their privacy policy.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Apple/Google:</Text> Payments are processed through the App Store
            or Google Play, subject to their respective privacy policies.
          </Text>
        </Section>

        <Section title="4. Data Storage and Security">
          <Text style={styles.paragraph}>
            Your vocabulary, learning progress, and preferences are stored locally on your device.
            We implement appropriate technical and organizational measures to protect your data against
            unauthorized access, alteration, or destruction.
          </Text>
          <Text style={styles.paragraph}>
            Photos are transmitted securely (HTTPS) to our AI provider for processing and are not
            permanently stored after analysis is complete.
          </Text>
        </Section>

        <Section title="5. Data Retention">
          <Text style={styles.paragraph}>
            We retain your data only as long as necessary to provide our services. Local data remains
            on your device until you delete the App. You can clear your learning data at any time
            through the App's settings.
          </Text>
        </Section>

        <Section title="6. Your Rights">
          <Text style={styles.paragraph}>Depending on your location, you may have the right to:</Text>
          <BulletPoint text="Access the personal data we hold about you" />
          <BulletPoint text="Request correction of inaccurate data" />
          <BulletPoint text="Request deletion of your data" />
          <BulletPoint text="Object to or restrict processing of your data" />
          <BulletPoint text="Data portability" />
          <Text style={styles.paragraph}>
            To exercise these rights, contact us at {CONTACT_EMAIL}.
          </Text>
        </Section>

        <Section title="7. Children's Privacy">
          <Text style={styles.paragraph}>
            The App is not intended for children under 13 years of age. We do not knowingly collect
            personal information from children under 13. If you are a parent or guardian and believe
            your child has provided us with personal information, please contact us at {CONTACT_EMAIL}.
          </Text>
        </Section>

        <Section title="8. International Data Transfers">
          <Text style={styles.paragraph}>
            Your information may be transferred to and processed in countries other than your own.
            We ensure appropriate safeguards are in place to protect your data in accordance with
            this Privacy Policy.
          </Text>
        </Section>

        <Section title="9. Changes to This Policy">
          <Text style={styles.paragraph}>
            We may update this Privacy Policy from time to time. We will notify you of any changes
            by posting the new Privacy Policy in the App and updating the "Last Updated" date.
          </Text>
        </Section>

        <Section title="10. Contact Us">
          <Text style={styles.paragraph}>
            If you have questions about this Privacy Policy or our data practices, please contact us at:
          </Text>
          <Text style={styles.contactInfo}>{COMPANY_NAME}</Text>
          <Text style={styles.contactInfo}>Email: {CONTACT_EMAIL}</Text>
        </Section>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function BulletPoint({ text }: { text: string }) {
  return (
    <View style={styles.bulletPoint}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 60,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.navy,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  lastUpdated: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    fontStyle: 'italic',
  },
  intro: {
    fontSize: typography.base,
    color: colors.textPrimary,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.navy,
    marginBottom: spacing.sm,
  },
  paragraph: {
    fontSize: typography.base,
    color: colors.textPrimary,
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  bold: {
    fontWeight: typography.bold,
  },
  bulletPoint: {
    flexDirection: 'row',
    marginLeft: spacing.sm,
    marginBottom: spacing.xs,
  },
  bullet: {
    fontSize: typography.base,
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  bulletText: {
    flex: 1,
    fontSize: typography.base,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  contactInfo: {
    fontSize: typography.base,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  bottomPadding: {
    height: 40,
  },
});
