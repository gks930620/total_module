package com.test.test.common.db;

public final class ProjectDbContextHolder {

    private static final ThreadLocal<String> PROJECT_CONTEXT = new ThreadLocal<>();

    private ProjectDbContextHolder() {
    }

    public static void setProjectId(String projectId) {
        PROJECT_CONTEXT.set(projectId);
    }

    public static String getProjectId() {
        return PROJECT_CONTEXT.get();
    }

    public static void clear() {
        PROJECT_CONTEXT.remove();
    }
}
