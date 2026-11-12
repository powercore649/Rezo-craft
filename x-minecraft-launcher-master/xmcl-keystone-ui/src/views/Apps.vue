<template>
  <div data-testid="apps-page" class="apps-page h-full w-full overflow-auto">
    <div class="apps-page__inner">
      <header class="apps-header">
        <v-avatar color="primary" variant="tonal" size="44">
          <v-icon>apps</v-icon>
        </v-avatar>
        <div class="apps-header__text">
          <h1 class="text-h6 font-weight-bold">
            {{ t('apps.name') }}
          </h1>
          <p class="text-body-2 text-medium-emphasis">
            {{ t('apps.description') }}
          </p>
        </div>
        <v-btn
          data-testid="apps-add"
          color="primary"
          prepend-icon="add"
          @click="pickApps"
        >
          {{ t('apps.add') }}
        </v-btn>
      </header>

      <div v-if="!apps.length" data-testid="apps-empty" class="apps-empty">
        <v-icon size="56" class="mb-2 opacity-40">
          apps
        </v-icon>
        <div class="text-subtitle-1 font-weight-medium">
          {{ t('apps.empty') }}
        </div>
        <div class="text-body-2 text-medium-emphasis mt-1">
          {{ t('apps.emptyHint') }}
        </div>
        <v-btn
          class="mt-5"
          color="primary"
          variant="tonal"
          prepend-icon="add"
          @click="pickApps"
        >
          {{ t('apps.add') }}
        </v-btn>
      </div>

      <div v-else class="apps-grid">
        <v-card
          v-for="app of apps"
          :key="app.id"
          :data-testid="`app-card`"
          class="app-card"
          variant="flat"
          @click="launch(app)"
        >
          <div class="app-card__icon">
            <img v-if="icons[app.id]" :src="icons[app.id]" alt="" class="app-card__image">
            <v-icon v-else size="30" class="opacity-70">
              rocket_launch
            </v-icon>
          </div>
          <div class="app-card__body">
            <div class="app-card__name">
              {{ app.name }}
            </div>
            <div class="app-card__path" :title="app.path">
              {{ app.path }}
            </div>
          </div>
          <v-progress-circular
            v-if="working === app.id"
            indeterminate
            size="20"
            width="2"
            color="primary"
          />
          <v-btn
            v-else
            icon="play_arrow"
            size="small"
            variant="text"
            color="primary"
            :aria-label="t('apps.launch')"
            @click.stop="launch(app)"
          />
          <v-menu location="bottom end">
            <template #activator="{ props: menuProps }">
              <v-btn
                v-bind="menuProps"
                icon="more_vert"
                size="small"
                variant="text"
                :aria-label="t('apps.more')"
                @click.stop
              />
            </template>
            <v-list density="compact">
              <v-list-item prepend-icon="edit" :title="t('apps.edit')" @click="openEdit(app)" />
              <v-list-item prepend-icon="delete_outline" :title="t('apps.remove')" @click="remove(app.id)" />
            </v-list>
          </v-menu>
        </v-card>
      </div>
    </div>

    <v-dialog v-model="editDialog" max-width="440">
      <v-card v-if="editing">
        <v-card-title>{{ t('apps.edit') }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="editForm.name"
            :label="t('apps.editName')"
            variant="outlined"
            density="comfortable"
            hide-details
            autofocus
            @keyup.enter="saveEdit"
          />
          <v-text-field
            v-model="editForm.args"
            class="mt-4"
            :label="t('apps.editArgs')"
            :hint="t('apps.editArgsHint')"
            persistent-hint
            variant="outlined"
            density="comfortable"
          />
          <div class="text-caption text-medium-emphasis mt-4 text-truncate" :title="editing.path">
            {{ editing.path }}
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="editDialog = false">
            {{ t('shared.cancel') }}
          </v-btn>
          <v-btn color="primary" variant="flat" @click="saveEdit">
            {{ t('shared.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts" setup>
import { useExternalApps, getAppIcon, type ExternalApp } from '@/composables/externalApps'
import { useNotifier } from '@/composables/notifier'
import { reactive, ref, watch } from 'vue'

const { t } = useI18n()
const { notify } = useNotifier()
const { apps, working, add, remove, update, launch: launchApp } = useExternalApps()

const icons = reactive<Record<string, string>>({})

watch(apps, async (list) => {
  for (const app of list) {
    if (icons[app.id]) continue
    const icon = await getAppIcon(app.path)
    if (icon) icons[app.id] = icon
  }
}, { immediate: true, deep: false })

async function pickApps() {
  const { canceled, filePaths } = await windowController.showOpenDialog({
    title: t('apps.add'),
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: t('apps.filterPrograms'), extensions: ['exe', 'bat', 'cmd', 'lnk', 'com'] },
      { name: t('apps.filterAll'), extensions: ['*'] },
    ],
  })
  if (canceled || !filePaths.length) return
  add(filePaths)
}

async function launch(app: ExternalApp) {
  const result = await launchApp(app)
  if (result.ok) return
  notify({
    level: 'error',
    title: t('apps.launchFailed', { name: app.name }),
    body: result.error === 'not-found' ? t('apps.notFound') : result.message,
  })
}

const editDialog = ref(false)
const editing = ref<ExternalApp>()
const editForm = reactive({ name: '', args: '' })

function openEdit(app: ExternalApp) {
  editing.value = app
  editForm.name = app.name
  editForm.args = app.args
  editDialog.value = true
}

function saveEdit() {
  if (!editing.value) return
  const name = editForm.name.trim()
  update(editing.value.id, { name: name || editing.value.name, args: editForm.args.trim() })
  editDialog.value = false
}
</script>

<style scoped>
.apps-page__inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 28px 24px 48px;
}

.apps-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 22px;
}

.apps-header__text {
  flex: 1;
  min-width: 0;
}

.apps-header__text p {
  margin: 2px 0 0;
}

.apps-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 64px 24px;
  border: 1px dashed rgba(127, 127, 127, 0.35);
  border-radius: 16px;
}

.apps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.app-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(127, 127, 127, 0.18);
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.app-card:hover {
  transform: translateY(-1px);
  border-color: rgba(46, 216, 126, 0.55);
}

.app-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(127, 127, 127, 0.12);
}

.app-card__image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.app-card__body {
  flex: 1;
  min-width: 0;
}

.app-card__name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-card__path {
  font-size: 12px;
  opacity: 0.6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  direction: rtl;
  text-align: left;
}
</style>
