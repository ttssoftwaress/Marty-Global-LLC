import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export type GenericEmailProps = {
  heading: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
};

// Email clients ignore stylesheets and most modern CSS, so these are inline
// styles rather than the app's Tailwind tokens — the one place that rule bends.
const styles = {
  body: {
    backgroundColor: '#f4f5f7',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    margin: '0',
    padding: '24px 0',
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    margin: '0 auto',
    maxWidth: '560px',
    padding: '32px',
  },
  heading: {
    color: '#0f172a',
    fontSize: '22px',
    fontWeight: 600,
    lineHeight: '1.3',
    margin: '0 0 16px',
  },
  text: {
    color: '#334155',
    fontSize: '15px',
    lineHeight: '1.6',
    margin: '0 0 16px',
    whiteSpace: 'pre-line' as const,
  },
  button: {
    backgroundColor: '#0f172a',
    borderRadius: '6px',
    color: '#ffffff',
    display: 'inline-block',
    fontSize: '15px',
    fontWeight: 600,
    padding: '12px 24px',
    textDecoration: 'none',
  },
  hr: {
    borderColor: '#e2e8f0',
    margin: '28px 0 16px',
  },
  footer: {
    color: '#64748b',
    fontSize: '12px',
    lineHeight: '1.5',
    margin: '0',
  },
};

export function GenericEmail({
  heading,
  body,
  actionLabel,
  actionUrl,
}: GenericEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{heading}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>{heading}</Heading>
          <Text style={styles.text}>{body}</Text>

          {actionLabel && actionUrl ? (
            <Section>
              <Button href={actionUrl} style={styles.button}>
                {actionLabel}
              </Button>
            </Section>
          ) : null}

          <Hr style={styles.hr} />
          {/* AGENTS.md: Marty Global is a filing service provider, not a law
              firm — this disclaimer stays on every outbound email. */}
          <Text style={styles.footer}>
            Marty Global LLC is a corporate filing service provider, not a law
            firm, and does not provide legal advice.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
