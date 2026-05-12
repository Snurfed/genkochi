import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../src/constants/design';

const LAST_UPDATED = 'April 21, 2026';
const CONTACT_EMAIL = 'snurfedllc@gmail.com';
const COMPANY_NAME = 'Snurfed LLC';
const APP_NAME = 'Genkochi';

export default function TermsOfServiceScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.lastUpdated}>Last Updated: {LAST_UPDATED}</Text>

        <Text style={styles.intro}>
          Welcome to {APP_NAME}! These Terms of Service ("Terms") govern your use of the {APP_NAME} mobile
          application (the "App") operated by {COMPANY_NAME} ("we," "our," or "us"). By downloading,
          installing, or using the App, you agree to be bound by these Terms.
        </Text>

        <Section title="1. Acceptance of Terms">
          <Text style={styles.paragraph}>
            By accessing or using the App, you confirm that you are at least 13 years old and agree
            to comply with these Terms. If you do not agree to these Terms, you may not use the App.
          </Text>
        </Section>

        <Section title="2. Description of Service">
          <Text style={styles.paragraph}>
            {APP_NAME} is a language learning application that uses photos to teach vocabulary and
            sentences. The App uses artificial intelligence to analyze images and generate educational
            content in multiple languages.
          </Text>
        </Section>

        <Section title="3. User Accounts and Subscriptions">
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Free Tier:</Text> The App offers limited free features including
            a daily limit on photo scans and basic vocabulary learning.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Premium Subscription:</Text> Premium features are available through
            monthly or yearly subscription plans. Subscriptions are billed through Apple App Store or
            Google Play Store.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Auto-Renewal:</Text> Subscriptions automatically renew unless
            cancelled at least 24 hours before the end of the current period. You can manage and cancel
            subscriptions in your device's account settings.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Refunds:</Text> Refund requests are handled by Apple or Google
            according to their respective refund policies.
          </Text>
        </Section>

        <Section title="4. User Content">
          <Text style={styles.paragraph}>
            You retain ownership of photos and content you submit to the App. By using the App, you
            grant us a limited license to process your photos for the purpose of providing language
            learning services.
          </Text>
          <Text style={styles.paragraph}>
            You agree not to submit content that:
          </Text>
          <BulletPoint text="Is illegal, harmful, or violates others' rights" />
          <BulletPoint text="Contains explicit or inappropriate material" />
          <BulletPoint text="Infringes on intellectual property rights" />
          <BulletPoint text="Contains malware or harmful code" />
        </Section>

        <Section title="5. Acceptable Use">
          <Text style={styles.paragraph}>You agree to use the App only for lawful purposes and in accordance with these Terms. You agree not to:</Text>
          <BulletPoint text="Use the App in any way that violates applicable laws" />
          <BulletPoint text="Attempt to gain unauthorized access to the App or its systems" />
          <BulletPoint text="Interfere with or disrupt the App's functionality" />
          <BulletPoint text="Use automated systems to access the App without permission" />
          <BulletPoint text="Reverse engineer or attempt to extract the source code" />
          <BulletPoint text="Use the App to harass, abuse, or harm others" />
        </Section>

        <Section title="6. Intellectual Property">
          <Text style={styles.paragraph}>
            The App and its original content, features, and functionality are owned by {COMPANY_NAME}
            and are protected by international copyright, trademark, and other intellectual property laws.
          </Text>
          <Text style={styles.paragraph}>
            The vocabulary, sentences, and educational content generated by the App are provided for
            your personal, non-commercial use only.
          </Text>
        </Section>

        <Section title="7. Third-Party Services">
          <Text style={styles.paragraph}>
            The App uses third-party services including OpenAI for image analysis and RevenueCat for
            subscription management. Your use of these services is subject to their respective terms
            and privacy policies.
          </Text>
        </Section>

        <Section title="8. Disclaimer of Warranties">
          <Text style={styles.paragraph}>
            THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
            IMPLIED. WE DO NOT GUARANTEE THAT THE APP WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
          </Text>
          <Text style={styles.paragraph}>
            Language learning content is generated by AI and may contain errors. We do not guarantee
            the accuracy of translations, vocabulary definitions, or grammatical explanations.
          </Text>
        </Section>

        <Section title="9. Limitation of Liability">
          <Text style={styles.paragraph}>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, {COMPANY_NAME.toUpperCase()} SHALL NOT BE LIABLE FOR
            ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE
            OF THE APP.
          </Text>
          <Text style={styles.paragraph}>
            Our total liability shall not exceed the amount you paid for the App in the twelve (12)
            months preceding the claim.
          </Text>
        </Section>

        <Section title="10. Indemnification">
          <Text style={styles.paragraph}>
            You agree to indemnify and hold harmless {COMPANY_NAME} and its officers, directors,
            employees, and agents from any claims, damages, or expenses arising from your use of
            the App or violation of these Terms.
          </Text>
        </Section>

        <Section title="11. Termination">
          <Text style={styles.paragraph}>
            We may terminate or suspend your access to the App immediately, without prior notice,
            for any reason, including breach of these Terms. Upon termination, your right to use
            the App will cease immediately.
          </Text>
        </Section>

        <Section title="12. Changes to Terms">
          <Text style={styles.paragraph}>
            We reserve the right to modify these Terms at any time. We will notify you of any changes
            by posting the new Terms in the App. Your continued use of the App after changes constitutes
            acceptance of the new Terms.
          </Text>
        </Section>

        <Section title="13. Governing Law">
          <Text style={styles.paragraph}>
            These Terms shall be governed by and construed in accordance with the laws of the United
            States, without regard to its conflict of law provisions.
          </Text>
        </Section>

        <Section title="14. Contact Us">
          <Text style={styles.paragraph}>
            If you have any questions about these Terms, please contact us at:
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
