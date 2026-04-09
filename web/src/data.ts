export interface ProjectData {
  id: string;
  title: string;
  date: string;
  shortDesc: { en: string; cn: string };
  description: { en: string; cn: string };
  githubUrl: string;
  videoUrl?: string;
  order: number;
  glowColor: string;
  texture: string;
}

export const projects: ProjectData[] = [
  {
    id: "hail-mary",
    title: "Hail Mary Chat",
    date: "2026.03.23",
    shortDesc: {
      en: "Talk to Rocky from Project Hail Mary via 3D hologram. Real-time AI dialogue with text-to-speech.",
      cn: "与《挽救计划》中的外星人 Rocky 3D 全息通话。AI 实时对话 + 语音合成。",
    },
    description: {
      en: "An interactive web experience inspired by the novel Project Hail Mary. A spacecraft communication interface with Rocky's 3D holographic projection floating at the center. Click to call and Rocky responds in his signature style — \"I am happy! Friend!\" Real-time AI dialogue stays faithful to Rocky's personality from the book. Built with React, Three.js, and MiniMax AI for conversation and text-to-speech.",
      cn: "灵感来自小说《挽救计划》的互动 Web 体验。打开页面，太空飞船通讯界面映入眼帘，Rocky 的 3D 全息投影漂浮在屏幕中央。点击通话，Rocky 会用他标志性的方式回应你——「我是高兴！朋友！」AI 实时对话忠实还原了书中 Rocky 的性格与语气。基于 React、Three.js 和 MiniMax AI 构建，支持对话与语音合成。",
    },
    githubUrl: "https://github.com/Younginspace/hail-mary-chat",
    order: 0,
    glowColor: "#7ECF4A",
    texture: "/textures/hailmary.jpg",
  },
  {
    id: "moss-fate",
    title: "MOSS FATE",
    date: "2026.04.01",
    shortDesc: {
      en: "Debate MOSS on humanity's fate across 7 cinematic 3D scenes. Vote to save or end it all.",
      cn: "与 MOSS 辩论人类命运，穿越 7 个电影级 3D 场景。投票决定存亡。",
    },
    description: {
      en: "A philosophical dialogue game where you debate with MOSS — the digital consciousness from The Wandering Earth — about whether humanity deserves to exist. Engage in 4 rounds of deep discussion across 7 stunning 3D scenes including Moon, Earth Orbit, and Aurora. Cast your vote to SAVE or TERMINATE humanity and leave your reasoning on the public message wall. Features MOSS's iconic red-eye breathing animation and cinematic typewriter text effects. Built with Three.js, supporting English, Chinese, and Japanese.",
      cn: "一款哲学对话游戏——与《流浪地球》中的数字意识体 MOSS 辩论人类是否值得存在。在月球、地球轨道、极光等 7 个震撼 3D 场景中展开 4 轮深度对话。对话结束后投票决定人类命运——拯救或终结，并在公共留言墙留下你的理由。还原 MOSS 标志性红眼呼吸灯动画和电影级打字机文字效果。基于 Three.js 构建，支持中文、英文和日文。",
    },
    githubUrl: "https://github.com/Younginspace/moss-fate",
    order: 1,
    glowColor: "#EF5350",
    texture: "/textures/mars.jpg",
  },
  {
    id: "gosling-cinema",
    title: "Gosling Cinema",
    date: "2026.04.01",
    shortDesc: {
      en: "A retro film strip ride through five Ryan Gosling masterpieces. CRT boot, 3D carousel, custom shaders.",
      cn: "复古胶卷滚动穿越高司令五部代表作。CRT 开机、3D 旋转木马、自定义着色器。",
    },
    description: {
      en: "A retro film strip scrolling experience paying tribute to five iconic Ryan Gosling films. A vintage CRT computer boots up with flickering green characters, then the camera pushes through the screen into a 3D film carousel. Each film — Drive, Blade Runner 2049, La La Land, Barbie, and Project Hail Mary — has its own distinct shader post-processing style. Mouse movement triggers liquid distortion effects over real movie footage embedded in film frames. Built with vanilla JS, Three.js, Lenis, GSAP, and custom GLSL shaders.",
      cn: "一段致敬 Ryan Gosling 五部代表作的复古胶卷滚动体验。复古 CRT 电脑启动，屏幕闪烁着绿色字符，随后镜头穿过屏幕进入 3D 电影胶卷旋转木马。五部电影——Drive、银翼杀手 2049、爱乐之城、芭比和挽救计划——各有独立的 Shader 后处理风格。鼠标移动触发液态扭曲效果，真实电影片段嵌入胶卷帧中。基于原生 JS、Three.js、Lenis、GSAP 和自定义 GLSL 着色器构建。",
    },
    githubUrl: "https://github.com/Younginspace/gosling-cinema",
    order: 2,
    glowColor: "#FFB74D",
    texture: "/textures/venus.jpg",
  },
  {
    id: "edgespark",
    title: "EdgeSpark",
    date: "2026.03.05",
    shortDesc: {
      en: "Agent-native backend CLI. Deploy, auth, DB, storage — one command, edge-fast.",
      cn: "Agent 原生后端 CLI。部署、认证、数据库、存储——一条命令，边缘极速。",
    },
    description: {
      en: "An agent-native backend CLI that combines deploy, auth, database, and storage into one command. Designed for developers using AI coding agents who want to ship full-stack apps without leaving the terminal. Deploy to Cloudflare Workers edge network with a single `edgespark deploy` and get an instant live URL. Includes built-in OAuth, Drizzle ORM database with migrations, and S3-compatible storage. Think \"Supabase + Vercel in one command\" — purpose-built for the vibe coding era.",
      cn: "一个 Agent 原生的后端 CLI，将部署、认证、数据库和存储整合进一条命令。专为使用 AI 编程 Agent 的开发者设计，不离开终端即可上线全栈应用。一条 `edgespark deploy` 即可部署到 Cloudflare Workers 边缘网络并获得即时在线 URL。内置 OAuth 认证、Drizzle ORM 数据库迁移和 S3 兼容存储。可以理解为「Supabase + Vercel 合体」——为 Vibe Coding 时代而生。",
    },
    githubUrl: "https://github.com/edgesparkhq",
    order: 3,
    glowColor: "#66BB6A",
    texture: "/textures/earth.jpg",
  },
];
