export type Dept = '技术部' | '竞赛部' | '组织部' | '宣传部' | '创新创业部';

export interface Member {
  id: string;
  name: string;
  dept: Dept;
  role?: string;
  grade: string;
  skills: string[];
  /** 关联的内容 id */
  projects: string[];
  bio?: string;
}

export const depts: Dept[] = ['技术部', '竞赛部', '组织部', '宣传部', '创新创业部'];

export const members: Member[] = [
  {
    id: 'm01',
    name: '陈屿',
    dept: '技术部',
    role: '部长',
    grade: '2024 级',
    skills: ['前端', 'Astro', 'AI 应用'],
    projects: ['p01', 'p03'],
    bio: '负责技术部整体节奏，做网站和 AI 工作流。',
  },
  {
    id: 'm02',
    name: '林知',
    dept: '技术部',
    role: '课程负责人',
    grade: '2024 级',
    skills: ['Python', '数据处理', '教学'],
    projects: ['p02', 'c01'],
    bio: '带第一门课，擅长把复杂的东西拆成能上手的小步骤。',
  },
  {
    id: 'm03',
    name: '周行',
    dept: '技术部',
    grade: '2025 级',
    skills: ['后端', 'FastAPI', '部署'],
    projects: ['p03'],
  },
  {
    id: 'm04',
    name: '苏禾',
    dept: '竞赛部',
    role: '部长',
    grade: '2024 级',
    skills: ['竞赛统筹', '答辩', '项目管理'],
    projects: ['k01', 'k02'],
    bio: '盯国赛和省赛的报名、组队、材料。',
  },
  {
    id: 'm05',
    name: '顾言',
    dept: '竞赛部',
    grade: '2025 级',
    skills: ['算法', '嵌入式'],
    projects: ['k01'],
  },
  {
    id: 'm06',
    name: '沈青',
    dept: '宣传部',
    role: '部长',
    grade: '2024 级',
    skills: ['视觉设计', 'AI 出图', '推文'],
    projects: ['p04', 'a01'],
  },
  {
    id: 'm07',
    name: '白露',
    dept: '宣传部',
    grade: '2025 级',
    skills: ['视频剪辑', '摄影'],
    projects: ['a02'],
  },
  {
    id: 'm08',
    name: '许川',
    dept: '创新创业部',
    role: '部长',
    grade: '2023 级',
    skills: ['软著材料', '商业计划', '答辩'],
    projects: ['p05'],
    bio: '对接项目孵化和软著、专利申请材料。',
  },
  {
    id: 'm09',
    name: '唐迟',
    dept: '创新创业部',
    grade: '2024 级',
    skills: ['文档撰写', '政策解读'],
    projects: ['p05', 'k02'],
  },
  {
    id: 'm10',
    name: '叶明',
    dept: '技术部',
    grade: '2025 级',
    skills: ['小程序', 'UI 实现'],
    projects: ['p01'],
  },
  {
    id: 'm11',
    name: '程野',
    dept: '竞赛部',
    grade: '2025 级',
    skills: ['机器人', '控制'],
    projects: ['k01'],
  },
  {
    id: 'm12',
    name: '夏至',
    dept: '宣传部',
    grade: '2025 级',
    skills: ['新媒体运营', '文案'],
    projects: ['a01'],
  },
  {
    id: 'm13',
    name: '方晓',
    dept: '组织部',
    role: '部长',
    grade: '2023 级',
    skills: ['活动策划', '场地与审批对接', '招新'],
    projects: [],
    bio: '负责协会内部会议与全校活动的策划、场地与学院对接。',
  },
  {
    id: 'm14',
    name: '季然',
    dept: '组织部',
    grade: '2025 级',
    skills: ['活动执行', '签到管理', '学院对接'],
    projects: [],
  },
];