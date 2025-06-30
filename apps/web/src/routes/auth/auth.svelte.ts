import { goto } from "$app/navigation";
import api, { SESSION_TOKEN_KEY } from "$lib/api/index.svelte";
import authState from "$lib/state/auth.svelte";
import { toasts } from "$lib/stores/toast";

class LoginState {
  email: string = $state("");
  username: string = $state("");
  password: string = $state("");
  rememberMe: boolean = $state(false);
  registrationToken: string = $state("");

  // OAuth params
  urlParams = new URLSearchParams(window.location.search);
  clientId = this.urlParams.get("client_id");
  redirectUri = this.urlParams.get("redirect_uri");
  scope = this.urlParams.get("scope");
  state = this.urlParams.get("state");
  responseType = this.urlParams.get("response_type");

  async checkEmail() {
    const checkEmailRes = await api.POST("/auth/email/init", {
      body: { email: this.email },
    });

    if (checkEmailRes.error) {
      if (checkEmailRes.error.error === "EmailVerificationRequired") {
        goto("/auth/verify" + window.location.search);
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
      goto("/auth/register" + window.location.search);
    } else if (checkEmailRes.error) {
      toasts.error("Unexpected response from server");
    } else {
      goto("/auth/login" + window.location.search);
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
  }

  async login() {
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
      authState.refresh();
      // pass in redirect_uri if present
      const redirectURL = new URLSearchParams(window.location.search).get(
        "redirect_uri",
      );
      this.finishAuth(redirectURL ?? undefined);
    } else {
      toasts.error("Login failed");
    }
  }

  async register() {
    if (!this.username.trim()) {
      toasts.error("Please enter a username");
      return;
    }

    const registerRes = await api.POST("/auth/register/finish", {
      body: {
        token: this.registrationToken,
        name: this.username.trim(),
        email: this.email, // this email doesn't actually matter since the backend should use the token to get the email
        password: this.password,
        captcha: "", // Assuming captcha is handled elsewhere or not needed here
      },
    });

    if (registerRes.error) {
      const message = registerRes.error.message?.includes("must match pattern")
        ? "Name contains invalid characters"
        : registerRes.error.message;
      toasts.error(
        message ||
          "An error occured during registration. Please try again later.",
      );
      console.error(registerRes.error);
    }

    if (registerRes.data?.data?.type === "session") {
      toasts.success("Account created successfully!");
      localStorage.setItem(SESSION_TOKEN_KEY, registerRes.data.data.token);
      authState.refresh();
      this.finishAuth("/team");
      return true;
    } else {
      toasts.error("Registration failed");
    }
  }

  async finishAuth(target = "/") {
    // handle OAuth flow when query params are present
    if (
      this.clientId &&
      this.redirectUri &&
      this.scope &&
      this.state &&
      this.responseType
    ) {
      const r = await api.POST("/auth/oauth/authorize_internal", {
        body: {
          client_id: this.clientId,
          redirect_uri: this.redirectUri,
          scope: this.scope?.split(" ") ?? [],
          state: this.state,
          response_type: this.responseType?.split(" ") ?? [],
        },
      });

      if (r.error) {
        toasts.error(r.error.message ?? "An error occurred during OAuth flow");
        goto("/");
        return;
      }

      if (r.data?.data?.url) {
        window.location.replace(r.data.data.url);
      } else {
        goto("/");
      }
    } else {
      goto(target);
    }
  }

  async verifyToken(token: string) {
    const response = await api.POST("/auth/register/token", {
      body: { token },
    });

    if (response.error) {
      console.error("Token verification failed:", response.error);
      const errorMessage =
        response.error?.message || "Invalid or expired registration link.";
      toasts.error(errorMessage);
      goto("/auth" + window.location.search);
      return;
    }

    // TODO: We can have multiple identities?
    if (response?.data?.data?.identity[0]?.provider_id) {
      const email = response.data.data.identity[0].provider_id;
      this.email = email;
      this.registrationToken = token;
    }
    // TODO: Handle when there is no error, but no provider?
  }
}

const loginState = new LoginState();
export default loginState;
