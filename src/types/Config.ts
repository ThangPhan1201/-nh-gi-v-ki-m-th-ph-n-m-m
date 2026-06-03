export interface Viewport {
  width: number;
  height: number;
}

export interface TestConfig {
  projectName: string;
  url: string;
  headless: boolean;
  slowMo: number;
  timeout: number;
  screenshotOnFailure: boolean;
  videoOnFailure: boolean;
  viewport: Viewport;
  suites: string[];
  outputDir: string;
  verbose: boolean;
}

export interface DiscoveredPage {
  url: string;
  title: string;
  forms: FormInfo[];
  inputs: InputInfo[];
  buttons: string[];
  links: string[];
  tables: number;
  hasLogin: boolean;
  depth: number;
}

export interface FormInfo {
  action: string;
  method: string;
  fields: FormField[];
}

export interface FormField {
  name: string;
  type: string;
  required: boolean;
}

export interface InputInfo {
  type: string;
  name?: string;
  id?: string;
  placeholder?: string;
}

export interface TestSuite {
  id: string;
  name: string;
  category: string;
  testCases: TestCase[];
}

export interface TestCase {
  id: string;
  name: string;
  steps: TestStep[];
}

export interface TestStep {
  id: string;
  action: string;
  selector?: string;
  value?: string;
  expected?: string;
  timeout?: number;
}
