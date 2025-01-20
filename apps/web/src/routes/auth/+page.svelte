<script lang="ts">
    import api from '$lib/api'

    let activeTab: 'login' | 'register' = $state('login')
    let email = $state('')
    let name = $state('')
    let password = $state('')

    async function handleSubmit(e: Event) {
        e.preventDefault()
        if (activeTab == 'register') {
            const { data } = await api.POST('/auth/email/init', {
                body: {
                    email,
                },
            })
            // @ts-expect-error /auth/email/init returns two 2XX codes, and the
            // first one is parsed into the response data type
            const token = data?.data?.token
            if (token) {
                const { data } = await api.POST('/auth/register/finish', {
                    body: {
                        token,
                        name,
                        email,
                        password,
                        captcha: '',
                    },
                })
                console.log(data)
            } else {
                alert('some error occurred...')
            }
        } else if (activeTab == 'login') {
            const r = await api.POST('/auth/email/finish', {
                body: {
                    email,
                    password,
                },
            })
            console.log(r.data?.data)
        }
    }
</script>

<div class="h-full flex items-center justify-center">
    <div class="card w-96 bg-base-100 shadow-solid border border-base-500">
        <div class="card-body">
            <div class="tabs tabs-boxed mb-4">
                <button
                    class="tab {activeTab === 'login' ? 'tab-active' : ''}"
                    onclick={() => activeTab = 'login'}
                >
                    Login
                </button>
                <button
                    class="tab {activeTab === 'register' ? 'tab-active' : ''}"
                    onclick={() => activeTab = 'register'}
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

                {#if activeTab === 'register'}
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
                    {activeTab === 'login' ? 'Sign In' : 'Create Account'}
                </button>
            </form>
        </div>
    </div>
</div>
