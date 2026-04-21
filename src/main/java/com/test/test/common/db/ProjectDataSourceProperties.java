package com.test.test.common.db;

import java.util.LinkedHashMap;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app.datasource")
public class ProjectDataSourceProperties {

    private String host = "localhost";
    private int port = 3306;
    private String username;
    private String password;
    private String driverClassName = "org.mariadb.jdbc.Driver";
    private String defaultProject = "default";
    private final Map<String, String> projects = new LinkedHashMap<>();
    private final Hikari hikari = new Hikari();

    @Getter
    @Setter
    public static class Hikari {
        private int maximumPoolSize = 10;
        private int minimumIdle = 5;
        private long idleTimeout = 300000;
        private long connectionTimeout = 20000;
    }
}
