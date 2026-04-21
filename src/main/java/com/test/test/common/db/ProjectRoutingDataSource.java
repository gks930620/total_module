package com.test.test.common.db;

import org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource;

public class ProjectRoutingDataSource extends AbstractRoutingDataSource {

    @Override
    protected Object determineCurrentLookupKey() {
        return ProjectDbContextHolder.getProjectId();
    }
}
