import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface ActivationReminderEmailProps {
  customerName: string;
  productName: string;
  activationUrl: string;
  daysLeft?: number;
}

export default function ActivationReminderEmail({
  customerName = "Cliente",
  productName = "tu cuenta",
  activationUrl = "#",
  daysLeft,
}: ActivationReminderEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Activa {productName} para empezar</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>¡Te estamos esperando!</Heading>
          
          <Text style={text}>
            Hola {customerName},
          </Text>
          
          <Text style={text}>
            Notamos que todavía no activaste {productName}. 
            {daysLeft && ` Te quedan ${daysLeft} días para completar la activación.`}
          </Text>

          <Text style={text}>
            Activar tu cuenta solo toma unos minutos y te permitirá acceder a todas las funcionalidades.
          </Text>

          <Section style={buttonSection}>
            <Button style={button} href={activationUrl}>
              Activar mi cuenta
            </Button>
          </Section>

          <Text style={text}>
            Si tenés algún problema o pregunta, respondé a este email y te ayudamos.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "40px 20px",
  maxWidth: "560px",
  borderRadius: "8px",
};

const h1 = {
  color: "#1a1a1a",
  fontSize: "24px",
  fontWeight: "600",
  lineHeight: "1.25",
  marginBottom: "24px",
};

const text = {
  color: "#4a4a4a",
  fontSize: "16px",
  lineHeight: "1.5",
  marginBottom: "16px",
};

const buttonSection = {
  textAlign: "center" as const,
  marginTop: "32px",
  marginBottom: "32px",
};

const button = {
  backgroundColor: "#10b981",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  padding: "12px 24px",
};
