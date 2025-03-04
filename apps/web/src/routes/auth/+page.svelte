<script lang="ts">
  import api from "$lib/api/index.svelte";
  import { toasts } from "$lib/stores/toast";
  import { performRedirect } from "$lib/utils/url";

  let activeTab: "login" | "register" = $state("login");
  let email = $state("");
  let name = $state("");
  let password = $state("");
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
        toasts.error(registerInitReq.error.message)
      }
      const token = registerInitReq.data?.data?.token;
      if (!token) {
        toasts.error("Unknown error occured")
        return
      }
      const finishRegisterReq = await api.POST("/auth/register/finish", {
        body: {
          token,
          name,
          email,
          password,
          captcha: "",
        },
      });

      if (finishRegisterReq.error) {
        toasts.error(finishRegisterReq.error.message)
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
        return;
      }
      console.log(r)
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
  <div class="card w-96 bg-base-100 shadow-solid border border-base-500">
    <div class="card-body">
      <div class="tabs tabs-boxed mb-4">
        <button
          class="tab {activeTab === 'login' ? 'tab-active' : ''}"
          onclick={() => (activeTab = "login")}
        >
          Login
        </button>
        <button
          class="tab {activeTab === 'register' ? 'tab-active' : ''}"
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
            class="input input-bordered"
            bind:value={email}
            required
          />
        </div>

        {#if activeTab === "register"}
          <div class="form-control mt-4">
            <label for="name" class="label">
              <span class="label-text">Name</span>
            </label>
            <input
              type="text"
              placeholder="name"
              class="input input-bordered"
              bind:value={name}
              required
            />
          </div>
        {/if}

        <div class="form-control mt-4">
          <label for="password" class="label">
            <span class="label-text">Password</span>
          </label>
          <input
            type="password"
            placeholder="••••••••"
            class="input input-bordered"
            bind:value={password}
            required
          />
        </div>

        <button class="btn btn-primary w-full mt-6 shadow-solid">
          {activeTab === "login" ? "Sign In" : "Create Account"}
        </button>
      </form>
    </div>
  </div>
</div>
