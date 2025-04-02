<script lang="ts">
  import api from "$lib/api/index.svelte";
  import { toasts } from "$lib/stores/toast";
  import { performRedirect } from "$lib/utils/url";
  import Icon from "@iconify/svelte";

  let activeTab: "login" | "register" = $state("login");
  let email = $state("");
  let username = $state("");
  let password = $state("");
  let rememberMe = $state(false);
  let passwordVisible = $state(false);
  let urlParams = new URLSearchParams(window.location.search);
  let clientId = urlParams.get("client_id");

  function successRedirect() {
    const redir = urlParams.get("redirect_to");
    if (redir) {
      performRedirect(redir);
    } else {
      window.location.replace("/");
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (activeTab == "register") {
      const registerInitReq = await api.POST("/auth/email/init", {
        body: {
          email,
        },
      });
      if (registerInitReq.error) {
        toasts.error(registerInitReq.error.message);
      }
      const token = registerInitReq.data?.data?.token;
      if (!token) {
        toasts.error("Unknown error occured");
        return;
      }
      const finishRegisterReq = await api.POST("/auth/register/finish", {
        body: {
          token,
          name: username,
          email,
          password,
          captcha: "",
        },
      });

      if (finishRegisterReq.error) {
        toasts.error(finishRegisterReq.error.message);
        return;
      }

      if (finishRegisterReq.data?.data?.type == "session") {
        successRedirect();
      }
    } else if (activeTab == "login") {
      const r = await api.POST("/auth/email/finish", {
        body: {
          email,
          password,
        },
      });

      if (r.error) {
        toasts.error(r.error.message);
        password = "";
        return;
      }
      console.log(r);
      if (r.data?.data?.type == "session") {
        successRedirect();
      }
    }
  }
</script>

<div class="h-full flex flex-col gap-8 items-center justify-center">
  {#if clientId}
    <h2 class="text text-xl">
      Log in to grant access to <span class="font-bold">{clientId}</span>
    </h2>
  {/if}
  <div
    class="card w-full max-w-md bg-base-100 shadow-solid border border-base-500"
  >
    <div class="card-body">
      <div class="tabs tabs-boxed mb-6">
        <button
          class="tab {activeTab === 'login' ? 'tab-active' : ''}"
          onclick={() => (activeTab = "login")}
        >
          Login
        </button>
        <button
          class="tab flex-1 {activeTab === 'register' ? 'tab-active' : ''}"
          onclick={() => (activeTab = "register")}
        >
          Register
        </button>
      </div>

      <form onsubmit={handleSubmit}>
        <div class="form-control">
          <label for="email" class="label">
            <span class="label-text">Email</span>
          </label>
          <input
            type="email"
            placeholder="email@example.com"
            class="input input-bordered w-full"
            bind:value={email}
            required
          />
        </div>

        {#if activeTab === "register"}
          <div class="form-control mt-4">
            <label for="name" class="label">
              <span class="label-text">Username</span>
            </label>
            <input
              id="username"
              type="text"
              placeholder="username"
              class="input input-bordered"
              bind:value={username}
              required
            />
          </div>
        {/if}

        <div class="form-control mt-4">
          <label for="password" class="label">
            <span class="label-text">Password</span>
          </label>
          <div class="relative">
            <input
              type={passwordVisible ? "text" : "password"}
              placeholder="••••••••"
              class="input input-bordered w-full pr-10"
              bind:value={password}
              required
            />
            <button
              type="button"
              class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
              onclick={() => (passwordVisible = !passwordVisible)}
            >
              {#if passwordVisible}
                <Icon icon="material-symbols:visibility" class="text-3xl" />
              {:else}
                <Icon icon="material-symbols:visibility-off" class="text-3xl" />
              {/if}
            </button>
          </div>
        </div>

        <!-- This does not work at the moment, but will be useful -->
        {#if activeTab === "login"}
          <div class="flex justify-between items-center mt-2">
            <label class="cursor-pointer label justify-start">
              <input
                type="checkbox"
                class="checkbox checkbox-sm mr-2"
                bind:checked={rememberMe}
              />
              <span class="label-text">Remember me</span>
            </label>
            <a href="/auth/reset-password" class="text-sm link link-hover">
              Forgot password?
            </a>
          </div>
        {/if}

        <!-- This button does not work -->
        {#if activeTab === "login"}
          <div class="divider text-sm text-gray-500">OR</div>
          <button
            type="button"
            class="btn btn-outline w-full"
            onclick={() => toasts.info("TODO: OAuth not implemented yet")}
          >
            Continue with OAuth
          </button>
        {/if}

        <button class="btn btn-primary w-full mt-6 shadow-solid">
          {activeTab === "login" ? "Sign In" : "Create Account"}
        </button>
      </form>
    </div>
  </div>
</div>
