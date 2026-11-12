import { createRouter, createWebHashHistory } from 'vue-router'

// NovaCraft: pick the landing route before the router reads the hash, so a cold
// start renders the dashboard directly instead of navigating a second time.
if (!location.hash || location.hash === '#' || location.hash === '#/') {
  history.replaceState(null, '', '#/home')
}

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: () => import('@/views/HomeLayout.vue'),
      children: [
        {
          path: '',
          components: {
            default: () => import('@/views/Home.vue'),
            extensions: () => import('@/views/HomeExtension.vue'),
            actions: () => import('@/views/HomeActions.vue'),
          },
        },
        {
          path: 'save',
          components: {
            default: () => import('@/views/Save.vue'),
            extensions: () => import('@/views/SaveExtension.vue'),
            actions: () => import('@/views/SaveActions.vue'),
          },
        },
        {
          path: 'mods',
          components: {
            default: () => import('@/views/Mod.vue'),
            extensions: () => import('@/views/ModExtension.vue'),
            actions: () => import('@/views/ModActions.vue'),
          },
        },
        {
          path: 'resourcepacks',
          components: {
            default: () => import('@/views/ResourcePack.vue'),
            extensions: () => import('@/views/ResourcePackExtension.vue'),
            actions: () => import('@/views/ResourcePackActions.vue'),
          },
        },
        {
          path: 'shaderpacks',
          components: {
            default: () => import('@/views/ShaderPack.vue'),
            extensions: () => import('@/views/ShaderPackExtension.vue'),
            actions: () => import('@/views/ShaderPackActions.vue'),
          },
        },
        {
          path: 'blueprints',
          meta: { blueprintState: true },
          components: {
            default: () => import('@/views/Blueprint.vue'),
            extensions: () => import('@/views/BlueprintExtension.vue'),
            actions: () => import('@/views/BlueprintActions.vue'),
          },
        },
        {
          path: 'screenshots',
          redirect: '/',
        },
        {
          path: 'base-setting',
          components: {
            default: () => import('@/views/BaseSetting.vue'),
            extensions: () => import('@/views/BaseSettingExtension.vue'),
            actions: () => import('@/views/BaseSettingActions.vue'),
          },
        },
        {
          path: 'base-setting/modrinth-project',
          redirect: { path: '/base-setting', query: { target: 'modrinth-project' } },
        },
      ],
    },
    {
      path: '/store',
      component: () => import('@/views/Store.vue'),
      children: [
        {
          path: '',
          component: () => import('@/views/StoreEntry.vue'),
        },
        {
          path: 'modrinth/:id',
          component: () => import('@/views/StoreProjectModrinth.vue'),
          props: (route) => ({ id: route.params.id }),
        },
        {
          path: 'curseforge/:id',
          component: () => import('@/views/StoreProjectCurseforge.vue'),
          props: (route) => ({ id: Number(route.params.id) }),
        },
        {
          path: 'ftb/:id',
          component: () => import('@/views/StoreProjectFeedTheBeast.vue'),
          props: (route) => ({ id: Number(route.params.id) }),
        },
      ],
    },
    {
      path: '/protection',
      component: () => import('@/views/Protection.vue'),
    },
    {
      path: '/setting',
      component: () => import('@/views/Setting.vue'),
    },
    {
      path: '/me',
      component: () => import('@/views/Me.vue'),
      meta: { workspaceSidePanel: true },
    },
    {
      path: '/multiplayer',
      component: () => import('@/views/MultiplayerDesktop.vue'),
      meta: { workspaceSidePanel: true },
    },
    {
      path: '/accounts',
      component: () => import('@/views/AppAccounts.vue'),
    },
    {
      path: '/servers',
      component: () => import('@/views/AppServers.vue'),
    },
    {
      path: '/network',
      component: () => import('@/views/AppNetwork.vue'),
    },
    {
      path: '/news',
      component: () => import('@/views/AppNews.vue'),
    },
    {
      path: '/notes',
      component: () => import('@/views/AppNotes.vue'),
    },
    {
      path: '/writer',
      component: () => import('@/views/AppWriter.vue'),
    },
    {
      path: '/home',
      component: () => import('@/views/AppHome.vue'),
    },
    {
      path: '/apps',
      component: () => import('@/views/Apps.vue'),
    },
  ],
})
