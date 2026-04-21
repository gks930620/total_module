package com.test.test.common.config;

import com.test.test.common.db.ProjectDataSourceProperties;
import com.test.test.common.db.ProjectRoutingDataSource;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.annotation.PreDestroy;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

@Configuration
@RequiredArgsConstructor
public class RoutingDataSourceConfig {

    private final ProjectDataSourceProperties properties;
    private final List<HikariDataSource> managedDataSources = new ArrayList<>();

    @Bean
    @Primary
    public DataSource routingDataSource() {
        validateProperties();

        Map<Object, Object> targetDataSources = new LinkedHashMap<>();
        properties.getProjects().forEach((projectId, dbName) -> {
            HikariDataSource dataSource = buildDataSource(dbName);
            managedDataSources.add(dataSource);
            targetDataSources.put(projectId, dataSource);
        });

        ProjectRoutingDataSource routingDataSource = new ProjectRoutingDataSource();
        routingDataSource.setTargetDataSources(targetDataSources);
        routingDataSource.setDefaultTargetDataSource(targetDataSources.get(properties.getDefaultProject()));
        routingDataSource.afterPropertiesSet();
        return routingDataSource;
    }

    @PreDestroy
    public void closeDataSources() {
        managedDataSources.forEach(HikariDataSource::close);
    }

    private HikariDataSource buildDataSource(String dbName) {
        HikariDataSource dataSource = new HikariDataSource();
        dataSource.setDriverClassName(properties.getDriverClassName());
        dataSource.setJdbcUrl(String.format("jdbc:mariadb://%s:%d/%s",
                properties.getHost(), properties.getPort(), dbName));
        dataSource.setUsername(properties.getUsername());
        dataSource.setPassword(properties.getPassword());
        dataSource.setMaximumPoolSize(properties.getHikari().getMaximumPoolSize());
        dataSource.setMinimumIdle(properties.getHikari().getMinimumIdle());
        dataSource.setIdleTimeout(properties.getHikari().getIdleTimeout());
        dataSource.setConnectionTimeout(properties.getHikari().getConnectionTimeout());
        return dataSource;
    }

    private void validateProperties() {
        if (properties.getProjects().isEmpty()) {
            throw new IllegalStateException("app.datasource.projects must contain at least one project entry.");
        }
        if (!properties.getProjects().containsKey(properties.getDefaultProject())) {
            throw new IllegalStateException("app.datasource.default-project must exist in app.datasource.projects.");
        }
    }
}
