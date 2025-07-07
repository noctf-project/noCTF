<script module lang="ts">
  import type { Difficulty } from "$lib/constants/difficulties";

  export interface Flag {
    data: string;
    strategy:
      | "case_sensitive"
      | "case_insensitive"
      | "regex_sensitive"
      | "regex_insensitive";
  }

  type Props =
    | {
        mode: "edit";
        challData: ChallData;
      }
    | {
        mode: "create";
        challData?: ChallData;
      };

  export interface ScoringStrat {
    strategy: string;
    params: { [k in string]: number };
  }

  export interface ExistingFile {
    filename: string;
    id: number;
    is_attachment: boolean;
  }

  export interface ChallData {
    id: number;
    title: string;
    description: string;
    isHidden: boolean;
    visibleAt?: string;
    difficulty: Difficulty | "";
    categories: string[];
    score: ScoringStrat;
    flags: Flag[];
    files: ExistingFile[];
    version: number;
  }
</script>

<script lang="ts">
  import Icon from "@iconify/svelte";
  import axios from "axios";
  import { Carta, MarkdownEditor } from "carta-md";
  import DOMPurify from "isomorphic-dompurify";
  import "carta-md/default.css";
  import { Parser } from "expr-eval";

  import api, { SESSION_TOKEN_KEY, wrapLoadable } from "$lib/api/index.svelte";
  import {
    categoryToIcon,
    slugify,
  } from "$lib/utils/challenges";
  import { CATEGORIES } from "$lib/constants/categories";

  const { mode, challData }: Props = $props();

  let challengeName = $state<string>(challData?.title ?? "");
  const slug = $derived(slugify(challengeName));
  let description = $state<string>(challData?.description ?? "");
  let isHidden = $state<boolean>(challData?.isHidden ?? false);
  let visibleAt = $state<string>(challData?.visibleAt ?? "");
  let catInput = $state<string>("");
  let categories = $state<string[]>(challData?.categories || []);
  let difficulty = $state<Difficulty | "">(challData?.difficulty || "");
  let files = $state<File[]>([]);
  let existingFiles = $state<ExistingFile[]>(challData?.files ?? []);
  let flags = $state<Flag[]>(
    challData?.flags ?? [{ data: "", strategy: "case_sensitive" }],
  );

  let isCreating = $state<boolean>(false);
  let creationStep = $state<string>("");
  let creationError = $state<string | null>(null);
  let creationCurrentFile = $state<string>("");
  let creationFileUploadProgress = $state<number>(0);

  const scoringStrategies = wrapLoadable(api.GET("/admin/scoring_strategies"));
  let scoringType = $state<string>(challData?.score?.strategy ?? "");
  let scoringParams = $state<{ [k in string]: number }>(
    challData?.score?.params ?? {},
  );
  const resetScoringParams = () => {
    scoringParams = {};
  };
  const paramsFromStrategy = (strategy: string) => {
    if (!scoringStrategies.r) return [];
    const p = Parser.parse(scoringStrategies.r.data!.data[strategy]!.expr);
    return p.variables().filter((v) => v !== "ctx");
  };

  const carta = new Carta({
    sanitizer: DOMPurify.sanitize,
  });

  function handleCatInput(event: KeyboardEvent): void {
    if (event.key === "Enter" && catInput.trim()) {
      event.preventDefault();
      if (hasCat(catInput.trim())) {
        return;
      }
      categories = [...categories, catInput.trim()];
      catInput = "";
    }
  }
  function addCat(cat: string): void {
    if (hasCat(cat.trim())) {
      return;
    }
    categories = [...categories, cat.trim()];
  }
  function hasCat(cat: string): boolean {
    return categories.includes(cat);
  }
  function removeCat(index: number): void {
    categories = categories.filter((_, i) => i !== index);
  }
  function removeCatS(cat: string): void {
    categories = categories.filter((c, _) => c !== cat);
  }

  function handleFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const selectedFiles = Array.from(input.files);
      for (let file of selectedFiles) {
        // remove the file from the existing set (if it exists) and add it to
        // the pending (live) set
        existingFiles = existingFiles.filter((f) => f.filename !== file.name);
        files.push(file);
      }
    }
  }
  function removeFile(index: number): void {
    files = files.filter((_, i) => i !== index);
  }
  function removeExistingFile(index: number): void {
    existingFiles = existingFiles.filter((_, i) => i !== index);
  }

  function addFlag(): void {
    flags = [...flags, { data: "", strategy: "case_sensitive" }];
  }
  function removeFlag(index: number): void {
    flags = flags.filter((_, i) => i !== index);
  }

  function createTags() {
    let tags: { [k in string]: string } = {};
    if (difficulty) {
      tags["difficulty"] = difficulty;
    }
    tags["categories"] = categories.join(",");
    return tags;
  }

  async function handleSubmit(event: Event): Promise<void> {
    event.preventDefault();

    if (flags.filter((f) => f.data).length == 0) {
      if (!confirm("No flags set, are you sure you want to proceed?")) {
        return;
      }
    }

    isCreating = true;
    creationError = null;
    creationStep =
      mode == "create" ? "Creating challenge..." : "Editing challenge...";

    const private_metadata = {
      solve: {
        source: "flag",
        flag: flags.filter((f) => f.data), // don't allow empty flags
      },
      score: {
        strategy: scoringType,
        params: scoringParams,
      },
      files: [],
    };
    const payload = {
      slug,
      title: challengeName,
      description,
      hidden: isHidden,
      visible_at: visibleAt ? new Date(visibleAt).toISOString() : "",
      tags: createTags(),
      private_metadata,
    };
    let fileRefsToAdd = existingFiles.map((f) => ({
      id: f.id,
      is_attachment: true,
    }));

    let challengeId, version;

    if (mode == "create") {
      const res = await api.POST("/admin/challenges", { body: payload });
      if (res.error) {
        // @ts-expect-error openapi-fetch mishandles error??
        creationError = res.error.message;
        return;
      }
      challengeId = res.data.data.id;
      version = res.data.data.version;
    } else {
      const res = await api.PUT("/admin/challenges/{id}", {
        params: { path: { id: challData.id } },
        body: {
          ...payload,
          private_metadata: { ...private_metadata, files: fileRefsToAdd },
          version: challData.version,
        },
      });
      if (res.error) {
        // @ts-expect-error openapi-fetch mishandles error??
        creationError = res.error.message;
        return;
      }
      challengeId = challData.id;
      version = res.data.data.version;
      challData.version = version;
    }

    if (files.length > 0) {
      creationStep = "Uploading files...";
      for (const file of files) {
        creationCurrentFile = file.name;
        const formData = new FormData();
        formData.append("file", file);
        const res = await api.POST("/admin/files", {
          async fetch(input) {
            const axiosResponse = await axios.post(input.url, formData, {
              // TODO: this is dodgy, migrate into file
              headers: {
                Authorization: `Bearer ${window.localStorage.getItem(SESSION_TOKEN_KEY)}`,
              },
              onUploadProgress: (progressEvent_1) => {
                creationFileUploadProgress = Math.round(
                  (progressEvent_1.loaded * 100) / (progressEvent_1.total ?? 0),
                );
              },
            });
            return new Response(JSON.stringify(axiosResponse.data), {
              status: axiosResponse.status,
              statusText: axiosResponse.statusText,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              headers: new Headers(axiosResponse.headers as any),
            });
          },
        });
        if (res.error) {
          // @ts-expect-error openapi-fetch mishandles error??
          creationError = res.error.message;
          return;
        }
        const { id } = res.data.data;
        fileRefsToAdd.push({ id, is_attachment: true });
      }
    }

    if (files.length > 0 || challData?.files?.length != existingFiles.length) {
      creationStep = "Adding files to challenge...";
      const updateRes = await api.PUT("/admin/challenges/{id}", {
        params: {
          path: {
            id: challengeId,
          },
        },
        body: {
          version,
          private_metadata: {
            ...private_metadata,
            files: fileRefsToAdd,
          },
        },
      });

      if (updateRes.error) {
        // @ts-expect-error openapi-fetch mishandles error??
        creationError = updateRes.error.message;
        return;
      }
    }

    creationStep = "Done";
  }
</script>

<div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
  <div
    class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6"
  >
    <div class="flex items-center gap-4">
      <a href="/admin/challenges" class="btn btn-sm bg-base-100 pop hover:pop">
        <Icon icon="material-symbols:arrow-back" class="text-lg" />
        Back to Challenges
      </a>
      {#if mode == "create"}
        <h1 class="text-2xl font-bold">New Challenge</h1>
      {:else}
        <h1 class="text-2xl font-bold">Edit Challenge</h1>
      {/if}
    </div>
  </div>

  <div class="card bg-base-100 pop rounded-lg w-full">
    <div class="card-body">
      <form
        onsubmit={handleSubmit}
        class="space-y-6"
        aria-label="Challenge creation form"
      >
        <div class="form-control w-full">
          <label for="challenge-name" class="label">
            <span class="label-text">Challenge Name</span>
          </label>
          <input
            type="text"
            id="challenge-name"
            bind:value={challengeName}
            class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
            placeholder="Enter challenge name"
            required
            aria-required="true"
          />
          <div class="label">
            <span class="label-text-alt">Slug: {slug}</span>
          </div>
        </div>

        <div class="form-control w-full">
          <label for="description-editor" class="label">
            <span class="label-text">Description</span>
          </label>
          <div class="rounded-lg bg-base-200 border border-base-300">
            <MarkdownEditor {carta} bind:value={description} mode="tabs" />
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="form-control w-full">
            <label for="hidden-toggle" class="label cursor-pointer">
              <span class="label-text">Hidden</span>
              <div
                class="tooltip"
                data-tip="If hidden is set to true, the challenge will NOT be publicly visible even after the 'Visible At' time"
              >
                <Icon icon="material-symbols:help" class="text-sm opacity-60" />
              </div>
            </label>
            <input
              type="checkbox"
              id="hidden-toggle"
              bind:checked={isHidden}
              class="toggle toggle-primary"
              aria-label="Toggle challenge visibility"
            />
          </div>

          <div class="form-control w-full">
            <label for="visible-at" class="label">
              <span class="label-text">Visible At</span>
            </label>
            <input
              type="datetime-local"
              id="visible-at"
              bind:value={visibleAt}
              class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
              aria-label="Challenge visibility start date and time"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="form-control w-full">
            <label for="difficulty" class="label">
              <span class="label-text">Difficulty</span>
            </label>
            <select
              id="difficulty"
              bind:value={difficulty}
              class="select select-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
            >
              <option value="">Select difficulty</option>
              <option value="beginner">Beginner</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div class="form-control w-full lg:col-span-2">
            <label for="cat-input" class="label">
              <span class="label-text">Categories</span>
              <span class="label-text-alt">Press Enter to add</span>
            </label>
            <div class="flex flex-wrap gap-2 mb-2">
              {#each CATEGORIES as cat}
                {@const has = hasCat(cat)}
                <button
                  onclick={(e) => {
                    e.preventDefault();
                    return has ? removeCatS(cat) : addCat(cat);
                  }}
                  class="tooltip btn btn-xs {has
                    ? 'btn-primary'
                    : 'btn-outline'} pop hover:pop"
                  data-tip={cat}
                >
                  <Icon icon={categoryToIcon(cat)} class="text-sm" />
                </button>
              {/each}
            </div>
            <input
              type="text"
              id="cat-input"
              bind:value={catInput}
              onkeydown={handleCatInput}
              class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
              placeholder="Add categories..."
              aria-label="Add challenge categories"
            />
            <div
              class="flex flex-wrap gap-2 mt-2"
              role="list"
              aria-label="Challenge categories"
            >
              {#each categories as cat, index}
                <div
                  class="badge badge-primary badge-sm gap-2 pop"
                  role="listitem"
                >
                  <Icon icon={categoryToIcon(cat)} class="text-xs" />
                  {cat}
                  <button
                    type="button"
                    onclick={() => removeCat(index)}
                    class="opacity-60 hover:opacity-100"
                    aria-label={`Remove ${cat} category`}
                  >
                    <Icon icon="material-symbols:close" class="text-xs" />
                  </button>
                </div>
              {/each}
            </div>
          </div>
        </div>

        <div class="space-y-6">
          <h2 class="text-lg font-semibold">Scoring Configuration</h2>
          {#if scoringStrategies.loading}
            <div class="flex items-center justify-center py-8">
              <div class="loading loading-spinner loading-md"></div>
              <span class="ml-2">Loading scoring strategies...</span>
            </div>
          {:else}
            <div class="space-y-4">
              <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="form-control w-full">
                  <label for="scoring-type" class="label">
                    <span class="label-text">Scoring Algorithm</span>
                  </label>
                  <select
                    id="scoring-type"
                    bind:value={scoringType}
                    onchange={resetScoringParams}
                    required
                    class="select select-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
                  >
                    {#each Object.keys(scoringStrategies.r.data!.data!) as strategy}
                      <option value={strategy}>{strategy}</option>
                    {/each}
                  </select>
                </div>
                <div class="lg:col-span-2 flex items-center">
                  <div
                    class="text-sm text-base-content/70 bg-base-200 rounded-lg p-4"
                  >
                    {scoringStrategies.r.data!.data[scoringType]?.description}
                  </div>
                </div>
              </div>

              {#if scoringType}
                <div
                  class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
                >
                  {#each paramsFromStrategy(scoringType) as p}
                    <div class="form-control w-full">
                      <label for={p} class="label">
                        <span class="label-text">{p}</span>
                      </label>
                      <input
                        type="number"
                        id={p}
                        required
                        bind:value={scoringParams[p]}
                        class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
                        min="0"
                        aria-label={p}
                      />
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <div class="space-y-6">
          <h2 class="text-lg font-semibold">Flags</h2>
          <div role="list" aria-label="Challenge flags" class="space-y-4">
            {#each flags as flag, index}
              <div
                class="flex flex-col sm:flex-row gap-4 p-4 bg-base-200 rounded-lg"
                role="listitem"
              >
                <div class="form-control w-full sm:w-48">
                  <label for={`flag-type-${index}`} class="label">
                    <span class="label-text">Type</span>
                  </label>
                  <select
                    id={`flag-type-${index}`}
                    bind:value={flag.strategy}
                    class="select select-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
                    aria-label={`Flag ${index + 1} type`}
                  >
                    <option value="case_sensitive"
                      >Static (case sensitive)</option
                    >
                    <option value="case_insensitive"
                      >Static (case insensitive)</option
                    >
                    <option value="regex_sensitive"
                      >Regex (case sensitive)</option
                    >
                    <option value="regex_insensitive"
                      >Regex (case insensitive)</option
                    >
                  </select>
                </div>

                <div class="form-control flex-1">
                  <label for={`flag-value-${index}`} class="label">
                    <span class="label-text">Flag Value</span>
                  </label>
                  <input
                    type="text"
                    id={`flag-value-${index}`}
                    bind:value={flag.data}
                    class="input input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
                    placeholder="Enter flag..."
                    aria-label={`Flag ${index + 1} value`}
                  />
                </div>

                <div class="flex justify-end items-end pb-2">
                  <button
                    type="button"
                    class="btn btn-sm btn-error pop hover:pop"
                    onclick={() => removeFlag(index)}
                    aria-label={`Remove flag ${index + 1}`}
                  >
                    <Icon icon="material-symbols:delete" class="text-lg" />
                  </button>
                </div>
              </div>
            {/each}
          </div>
          <button
            type="button"
            class="btn btn-outline btn-sm pop hover:pop"
            onclick={addFlag}
            aria-label="Add new flag"
          >
            <Icon icon="material-symbols:add" class="text-lg" />
            Add Flag
          </button>
        </div>

        <div class="space-y-6">
          <div
            class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
          >
            <h2 class="text-lg font-semibold">Challenge Files</h2>
            {#if mode == "edit"}
              <div class="flex flex-wrap gap-2 items-center text-sm">
                <span class="badge badge-secondary badge-sm gap-2">
                  <Icon icon="material-symbols:folder" class="text-xs" />
                  existing file
                </span>
                <span class="badge badge-primary badge-sm gap-2">
                  <Icon icon="material-symbols:upload" class="text-xs" />
                  replaced/new file
                </span>
                <div
                  class="tooltip"
                  data-tip="All replaced/new files will be (re)uploaded"
                >
                  <Icon
                    icon="material-symbols:help"
                    class="text-sm opacity-60"
                  />
                </div>
              </div>
            {/if}
          </div>

          <div class="form-control w-full">
            <label for="file-upload" class="label">
              <span class="label-text">Upload Files</span>
            </label>
            <input
              type="file"
              id="file-upload"
              onchange={handleFileSelect}
              class="file-input file-input-bordered w-full focus:outline-none focus:ring-0 focus:ring-offset-0"
              multiple
              aria-label="Upload challenge files"
            />
          </div>

          {#if existingFiles.length > 0 || files.length > 0}
            <div class="space-y-2">
              <h3 class="text-sm font-medium text-base-content/70">
                Attached Files
              </h3>
              <div
                class="flex flex-wrap gap-2"
                role="list"
                aria-label="Uploaded files"
              >
                {#each existingFiles as file, index}
                  <div class="flex items-center gap-2" role="listitem">
                    <span class="badge badge-secondary badge-lg gap-2 pop">
                      <Icon icon="material-symbols:folder" class="text-sm" />
                      {file.filename}
                      <button
                        type="button"
                        onclick={() => removeExistingFile(index)}
                        class="opacity-60 hover:opacity-100"
                        aria-label={`Remove ${file.filename}`}
                      >
                        <Icon icon="material-symbols:close" class="text-xs" />
                      </button>
                    </span>
                  </div>
                {/each}
                {#each files as file, index}
                  <div class="flex items-center gap-2" role="listitem">
                    <span class="badge badge-primary badge-lg gap-2 pop">
                      <Icon icon="material-symbols:upload" class="text-sm" />
                      {file.name}
                      <button
                        type="button"
                        onclick={() => removeFile(index)}
                        class="opacity-60 hover:opacity-100"
                        aria-label={`Remove ${file.name}`}
                      >
                        <Icon icon="material-symbols:close" class="text-xs" />
                      </button>
                    </span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <div
          class="flex flex-col sm:flex-row gap-4 justify-end pt-6 border-t border-base-300"
        >
          <a href="/admin/challenges" class="btn btn-outline pop hover:pop">
            <Icon icon="material-symbols:cancel" class="text-lg" />
            Cancel
          </a>
          <button
            type="submit"
            class="btn btn-primary pop hover:pop"
            aria-label={(mode == "create" ? "Create" : "Edit") + " challenge"}
          >
            <Icon
              icon={mode == "create"
                ? "material-symbols:add"
                : "material-symbols:edit"}
              class="text-lg"
            />
            {mode == "create" ? "Create" : "Update"} Challenge
          </button>
        </div>
      </form>
    </div>
  </div>

  {#if isCreating}
    <div class="modal modal-open">
      <div class="modal-box relative">
        <h3 class="font-bold text-lg mb-4">Creating {challengeName}</h3>

        {#if creationError}
          <div class="alert alert-error mb-4 pop">
            <Icon icon="material-symbols:error" class="text-xl" />
            <span>{creationError}</span>
          </div>
          <div class="modal-action">
            <button
              class="btn btn-error pop hover:pop"
              onclick={() => (isCreating = false)}
            >
              Close
            </button>
          </div>
        {:else if creationStep === "Done"}
          <div class="alert alert-success mb-4 pop">
            <Icon icon="material-symbols:success" class="text-xl" />
            <span>Challenge {mode == "create" ? "created" : "edited"}!</span>
          </div>
          <div class="modal-action">
            <button
              class="btn pop hover:pop"
              onclick={() => (isCreating = false)}
            >
              Close
            </button>
          </div>
        {:else}
          <div class="flex flex-col items-center gap-4">
            <div class="loading loading-spinner loading-lg text-primary"></div>
            <p class="text-center">{creationStep}</p>
            {#if creationStep === "Uploading files..." && creationCurrentFile}
              <div class="w-full">
                <p class="text-sm mb-2">Uploading: {creationCurrentFile}</p>
                <div class="w-full bg-base-200 rounded-full h-2.5">
                  <div
                    class="bg-primary h-2.5 rounded-full transition-all"
                    style="width: {creationFileUploadProgress}%"
                  ></div>
                </div>
                <p class="text-sm mt-1 text-center">
                  {creationFileUploadProgress}%
                </p>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
