export const PASSWORD_REQUIREMENTS_MESSAGE =
  "Parola trebuie să conțină minim 8 caractere, o literă mare, o literă mică și o cifră.";

export const NO_SALON_ACCESS_MESSAGE =
  "Contul nu este asociat niciunui salon.";

export function loginQueryError(code: string | null): string {
  if (code === "access") return NO_SALON_ACCESS_MESSAGE;
  if (code === "auth") {
    return "Linkul de autentificare a expirat. Încearcă din nou.";
  }
  if (code === "email_sso") {
    return "Nu am putut deschide Frizeo Email. Autentifică-te din nou.";
  }
  return "";
}

export function isValidPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password)
  );
}

export function isValidEmail(email: string): boolean {
  return /\S+@\S+\.\S+/.test(email.trim());
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function mapAuthError(message?: string): string {
  const msg = (message || "").toLowerCase();

  if (msg.includes("already registered") || msg.includes("already exists")) {
    return "Există deja un cont cu acest email.";
  }

  if (msg.includes("invalid login credentials")) {
    return "Email sau parolă greșită.";
  }

  if (msg.includes("password")) {
    return PASSWORD_REQUIREMENTS_MESSAGE;
  }

  if (msg.includes("valid email")) {
    return "Email invalid.";
  }

  return message || "A apărut o eroare. Încearcă din nou.";
}
