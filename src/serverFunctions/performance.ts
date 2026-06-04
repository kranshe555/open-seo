import { createServerFn } from "@tanstack/react-start";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";
import { z } from "zod";

const API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidWlkIjoxLCJ1c2VybmFtZSI6ImFkZWwiLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJleHAiOjIwOTU5NTUzMjYsImlhdCI6MTc4MDU5NTMyNn0.w0IfveuPzVjbNAVg2ub9ZC5rt89NUBsZDvrE0D6bH3Q";

async function getApiPrefixForProject(projectId: string): Promise<string> {
  const project = await ProjectRepository.getProjectById(projectId);
  const domain = project?.domain?.toLowerCase() ?? "";
  
  if (domain.includes("el-afdl") || domain.includes("elafdl")) {
    return "/api/elafdl-reports";
  } else if (domain.includes("coupoonat")) {
    return "/api/coupoonat-reports";
  } else {
    return "/api/reports";
  }
}

async function callDashboardApi(projectId: string, endpoint: string, method: string = "GET", body?: any): Promise<any> {
  const prefix = await getApiPrefixForProject(projectId);
  const url = `http://127.0.0.1:8800${prefix}${endpoint}`;
  
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${API_TOKEN}`,
  };
  
  if (body) {
    headers["Content-Type"] = "application/json";
  }
  
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Dashboard API error: ${response.status} - ${errorText}`);
  }
  
  return response.json() as any;
}

export const getPerformanceOverview = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .inputValidator((data: any) => z.object({ start: z.string(), end: z.string() }).parse(data))
  .handler(async ({ data, context }): Promise<any> => {
    return callDashboardApi(context.projectId, `/overview?start=${data.start}&end=${data.end}`) as any;
  });

export const getPerformancePages = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .inputValidator((data: any) => z.object({ start: z.string(), end: z.string() }).parse(data))
  .handler(async ({ data, context }): Promise<any> => {
    return callDashboardApi(context.projectId, `/pages?start=${data.start}&end=${data.end}`) as any;
  });

export const getPerformanceKeywords = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .inputValidator((data: any) => z.object({ start: z.string(), end: z.string() }).parse(data))
  .handler(async ({ data, context }): Promise<any> => {
    return callDashboardApi(context.projectId, `/keywords?start=${data.start}&end=${data.end}`) as any;
  });

export const getPerformanceTraffic = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .inputValidator((data: any) => z.object({ start: z.string(), end: z.string() }).parse(data))
  .handler(async ({ data, context }): Promise<any> => {
    return callDashboardApi(context.projectId, `/traffic?start=${data.start}&end=${data.end}`) as any;
  });

export const getPerformanceTechnical = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .inputValidator((data: any) => z.object({ start: z.string(), end: z.string() }).parse(data))
  .handler(async ({ data, context }): Promise<any> => {
    return callDashboardApi(context.projectId, `/technical?start=${data.start}&end=${data.end}`) as any;
  });

export const getPerformanceAnalysis = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .inputValidator((data: any) => z.object({ reportData: z.any(), reportType: z.string() }).parse(data))
  .handler(async ({ data, context }): Promise<any> => {
    return callDashboardApi(context.projectId, "/analyze", "POST", {
      report_data: data.reportData,
      report_type: data.reportType,
    }) as any;
  });
