<script module>
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
    ref: string;
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
  import "carta-md/default.css";
  import { Parser } from "expr-eval";

  import api, { wrapLoadable } from "$lib/api/index.svelte";
  import {
    categoryToIcon,
    difficultyToBgColour,
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
    sanitizer: false,
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
      files: {},
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
    let fileRefsToAdd: {
      [k in string]: { ref: string; is_attachment: boolean };
    } = Object.fromEntries(
      existingFiles.map((f) => [
        f.filename,
        { ref: f.ref, is_attachment: true },
      ]),
    );

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
              withCredentials: true,
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
        const { filename, ref } = res.data.data;
        fileRefsToAdd[filename] = { ref, is_attachment: true };
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

<div class="container mx-auto p-6 max-w-4xl">
  {#if mode == "create"}
    <h1 class="text-4xl font-bold mb-6">New Challenge</h1>
  {:else}
    <h1 class="text-4xl font-bold mb-6">Edit {challData.title}</h1>
  {/if}

  <form
    onsubmit={handleSubmit}
    class="space-y-6"
    aria-label="Challenge creation form"
  >
    <div class="form-control">
      <label for="challenge-name" class="label">
        <span class="label-text">Challenge Name</span>
      </label>
      <input
        type="text"
        id="challenge-name"
        bind:value={challengeName}
        class="input input-bordered w-full"
        required
        aria-required="true"
      />
      <div class="text-sm text-base-content/40 mt-2">{slug}</div>
    </div>

    <div class="flex flex-col">
      <span class="label-text p-2">Description</span>
      <div class="rounded-lg bg-base-100">
        <MarkdownEditor {carta} bind:value={description} mode="tabs" />
      </div>
    </div>

    <div class="flex gap-6">
      <div class="form-control">
        <div class="flex flex-row gap-0 items-center">
          <label for="hidden-toggle" class="label cursor-pointer">
            <span class="label-text mr-4">Hidden</span>
          </label>
          <div
            class="tooltip"
            data-tip="If hidden is set to true, the challenge will NOT be publicly visible even after the 'Visible At' time"
          >
            <Icon icon="material-symbols:help-rounded" />
          </div>
        </div>
        <input
          type="checkbox"
          id="hidden-toggle"
          bind:checked={isHidden}
          class="toggle toggle-primary mt-3"
          aria-label="Toggle challenge visibility"
        />
      </div>

      <div class="form-control flex-1">
        <label for="visible-at" class="label">
          <span class="label-text">Visible At</span>
        </label>
        <input
          type="datetime-local"
          id="visible-at"
          bind:value={visibleAt}
          class="input input-bordered"
          aria-label="Challenge visibility start date and time"
        />
      </div>
    </div>

    <div class="flex flex-row gap-4">
      <div class="form-control md:w-1/4">
        <label for="difficulty" class="label">
          <span class="label-text">Difficulty</span>
        </label>
        <select
          id="difficulty"
          bind:value={difficulty}
          class={"select select-bordered w-full " +
            (difficulty === "" ? "" : difficultyToBgColour(difficulty))}
        >
          <option value="">-</option>
          <option value="beginner">Beginner</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>

      <div class="form-control flex-grow">
        <label for="cat-input" class="label flex flex-row">
          <span class="label-text">Categories (Press Enter to add)</span>
          <div class="flex-grow"></div>
          <span class="label-text flex flex-row gap-1">
            {#each CATEGORIES as cat}
              {@const has = hasCat(cat)}
              <button
                onclick={(e) => {
                  e.preventDefault();
                  return has ? removeCatS(cat) : addCat(cat);
                }}
                class="tooltip"
                data-tip={cat}
              >
                <Icon
                  icon={categoryToIcon(cat)}
                  class={"text-lg " +
                    (has ? "text-primary" : "text-neutral-500")}
                />
              </button>
            {/each}
          </span>
        </label>
        <input
          type="text"
          id="cat-input"
          bind:value={catInput}
          onkeydown={handleCatInput}
          class="input input-bordered"
          placeholder="Add categories..."
          aria-label="Add challenge categories"
        />
        <div
          class="flex flex-wrap gap-2 mt-4"
          role="list"
          aria-label="Challenge categories"
        >
          {#each categories as cat, index}
            <div
              class="badge badge-primary badge-lg rounded-md gap-2"
              role="listitem"
            >
              <Icon icon={categoryToIcon(cat)} />
              {cat}
              <button
                type="button"
                onclick={() => removeCat(index)}
                aria-label={`Remove ${cat} category`}>✕</button
              >
            </div>
          {/each}
        </div>
      </div>
    </div>

    <div>
      <h2 class="text-lg mb-4 font-semibold">Scoring Configuration</h2>
      {#if scoringStrategies.loading}
        Loading...
      {:else}
        <div class="flex flex-col gap-4">
          <div class="flex flex-row justify-between">
            <div class="form-control md:w-1/4">
              <label for="scoring-type" class="label">
                <span class="label-text">Scoring Algorithm</span>
              </label>
              <select
                id="scoring-type"
                bind:value={scoringType}
                onchange={resetScoringParams}
                required
                class="select select-bordered w-full"
              >
                {#each Object.keys(scoringStrategies.r.data!.data!) as strategy}
                  <option value={strategy}>{strategy}</option>
                {/each}
              </select>
            </div>
            <div class="p-4 w-8/12 text-sm self-center">
              {scoringStrategies.r.data!.data[scoringType]?.description}
            </div>
          </div>

          {#if scoringType}
            <div class="flex flex-row gap-2">
              {#each paramsFromStrategy(scoringType) as p}
                <div class="form-control flex flex-col">
                  <label for={p} class="label">
                    <span class="label-text">{p}</span>
                  </label>
                  <input
                    type="number"
                    id={p}
                    required
                    bind:value={scoringParams[p]}
                    class="input input-bordered w-full"
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

    <div>
      <h2 class="text-lg mb-4 font-semibold">Flags</h2>
      <div role="list" aria-label="Challenge flags">
        {#each flags as flag, index}
          <div class="form-control flex flex-row gap-4 mb-4" role="listitem">
            <label for={`flag-type-${index}`} class="sr-only">Flag type</label>
            <select
              id={`flag-type-${index}`}
              bind:value={flag.strategy}
              class="select select-bordered w-32"
              aria-label={`Flag ${index + 1} type`}
            >
              <option value="case_sensitive">Static (case sensitive)</option>
              <option value="case_insensitive">Static (case insensitive)</option
              >
              <option value="regex_sensitive">Regex (case sensitive)</option>
              <option value="regex_insensitive">Regex (case insensitive)</option
              >
            </select>

            <label for={`flag-value-${index}`} class="sr-only">Flag value</label
            >
            <input
              type="text"
              id={`flag-value-${index}`}
              bind:value={flag.data}
              class="input input-bordered flex-1"
              placeholder="Enter flag..."
              aria-label={`Flag ${index + 1} value`}
            />
            <button
              type="button"
              class="btn btn-square btn-ghost"
              onclick={() => removeFlag(index)}
              aria-label={`Remove flag ${index + 1}`}>✕</button
            >
          </div>
        {/each}
      </div>
      <button
        type="button"
        class="btn btn-outline btn-sm"
        onclick={addFlag}
        aria-label="Add new flag">Add Flag</button
      >
    </div>

    <div class="form-control">
      <div class="flex flex-row">
        <label for="file-upload" class="label">
          <span class="label-text">Challenge Files</span>
        </label>
        <div class="flex-grow"></div>
        {#if mode == "edit"}
          <div class="flex flex-row gap-4 items-center">
            <span class="badge badge-secondary rounded-md flex flex-row gap-2">
              existing file
            </span>
            <span class="badge badge-primary rounded-md flex flex-row gap-2">
              replaced/new file
            </span>
            <div
              class="tooltip"
              data-tip="All replaced/new files will be (re)uploaded"
            >
              <Icon icon="material-symbols:help-rounded" />
            </div>
          </div>
        {/if}
      </div>
      <input
        type="file"
        id="file-upload"
        onchange={handleFileSelect}
        class="file-input file-input-bordered w-full"
        multiple
        aria-label="Upload challenge files"
      />
      <div
        class="mt-2 flex flex-row gap-2"
        role="list"
        aria-label="Uploaded files"
      >
        {#each existingFiles as file, index}
          <div class="flex items-center gap-2 mb-2" role="listitem">
            <span class="badge badge-secondary rounded-md flex flex-row gap-2">
              {file.filename}
              <button
                type="button"
                onclick={() => removeExistingFile(index)}
                aria-label={`Remove ${file.filename}`}>✕</button
              >
            </span>
          </div>
        {/each}
        {#each files as file, index}
          <div class="flex items-center gap-2 mb-2" role="listitem">
            <span class="badge badge-primary rounded-md flex flex-row gap-2">
              {file.name}
              <button
                type="button"
                onclick={() => removeFile(index)}
                aria-label={`Remove ${file.name}`}>✕</button
              >
            </span>
          </div>
        {/each}
      </div>
    </div>

    <div class="flex flex-row gap-4 justify-end">
      <a href="/admin/challenges" class="btn btn-error text-error-content pop">
        Cancel
      </a>
      <button
        type="submit"
        class="btn btn-primary border pop"
        aria-label={(mode == "create" ? "Create" : "Edit") + " challenge"}
      >
        {mode == "create" ? "Create" : "Edit"} challenge
      </button>
    </div>
  </form>

  {#if isCreating}
    <div class="modal modal-open">
      <div class="modal-box relative">
        <h3 class="font-bold text-lg mb-4">Creating {challengeName}</h3>

        {#if creationError}
          <div class="alert alert-error mb-4">
            <Icon icon="material-symbols:error" class="text-xl" />
            <span>{creationError}</span>
          </div>
          <div class="modal-action">
            <button class="btn btn-error" onclick={() => (isCreating = false)}>
              Close
            </button>
          </div>
        {:else if creationStep === "Done"}
          <div class="alert alert-success mb-4">
            <Icon icon="material-symbols:success" class="text-xl" />
            <span>Challenge {mode == "create" ? "created" : "edited"}!</span>
          </div>
          <div class="modal-action">
            <button class="btn" onclick={() => (isCreating = false)}>
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
