import { goto } from "$app/navigation";
import api, { SESSION_TOKEN_KEY } from "$lib/api/index.svelte";
import authState from "$lib/state/auth.svelte";
import { toasts } from "$lib/stores/toast";

type FlowStage =
  | "email"
  | "login"
  | "register"
  | "verification-required"
  | "verification-sent"
  | "forgot-password-request"
  | "forgot-password-sent";

class LoginState {
  email: string = $state("");
  username: string = $state("");
  password: string = $state("");
  rememberMe: boolean = $state(false);
  registrationToken: string = $state("");

  currentStage: FlowStage = $state("email");

  async checkEmail() {
    const checkEmailRes = await api.POST("/auth/email/init", {
      body: { email: this.email },
    });

    if (checkEmailRes.error) {
      if (checkEmailRes.error.error === "EmailVerificationRequired") {
        // goto("/auth/register");
        this.currentStage = "verification-required";
        return;
      }
      toasts.error(
        checkEmailRes.error.message ??
          "An unexpected error occurred when validating email. Please try again later.",
      );
      return;
    }

    // Handle different responses based on if email exists
    if (checkEmailRes.data?.data?.token) {
      this.registrationToken = checkEmailRes.data.data.token;
      this.currentStage = "register";
      goto("/auth/register");
    } else if (checkEmailRes.error) {
      toasts.error("Unexpected response from server");
    } else {
      this.currentStage = "login";
    }
  }

  async verifyEmail() {
    const { error } = await api.POST("/auth/email/init", {
      body: { email: loginState.email, verify: true },
    });
    if (error) {
      toasts.error(
        error.message ??
          "An unexpected error occurred when validating email. Please try again later.",
      );
      return;
    }
    this.currentStage = "verification-sent";
  }

  // login tries to log in the user with the provided email and password
  // and returns true if successful, false otherwise.
  async login(): Promise<boolean> {
    const loginRes = await api.POST("/auth/email/finish", {
      body: {
        email: this.email,
        password: this.password,
        remember: this.rememberMe,
      },
    });

    if (loginRes.error) {
      toasts.error(
        loginRes.error.message ??
          "An unexpected error occurred when logging in. Please try again later.",
      );
      return false;
    }
    if (loginRes.data?.data?.type === "session") {
      localStorage.setItem(SESSION_TOKEN_KEY, loginRes.data.data.token);
      authState.fetchState();
      return true;
    } else {
      toasts.error("Login failed");
    }
    return false;
  }

  async register(): Promise<boolean> {
    const registerRes = await api.POST("/auth/register/finish", {
      body: {
        token: this.registrationToken,
        name: this.username,
        email: this.email, // this email doesn't actually matter since the backend should use the token to get the email
        password: this.password,
        captcha: "", // Assuming captcha is handled elsewhere or not needed here
      },
    });

    if (registerRes.error) {
      toasts.error(
        registerRes.error.message ||
          "An error occured during registration. Please try again later.",
      );
      console.error(registerRes.error);
      return false;
    }

    if (registerRes.data?.data?.type === "session") {
      toasts.success("Account created successfully!");
      localStorage.setItem(SESSION_TOKEN_KEY, registerRes.data.data.token);
      authState.fetchState();
      return true;
    } else {
      toasts.error("Registration failed");
    }
    return false;
  }
}

const loginState = new LoginState();
export default loginState;
