package com.clinora;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.nio.file.Files;
import java.nio.file.Paths;

@SpringBootApplication
@EnableScheduling
public class ClinoraApplication {

    public static void main(String[] args) {
        loadDotenv();
        SpringApplication.run(ClinoraApplication.class, args);
    }

    private static void loadDotenv() {
        try {
            String envDir = null;
            if (Files.exists(Paths.get(".env"))) {
                envDir = "./";
            } else if (Files.exists(Paths.get("../.env"))) {
                envDir = "../";
            } else if (Files.exists(Paths.get("../../.env"))) {
                envDir = "../../";
            }

            if (envDir != null) {
                Dotenv dotenv = Dotenv.configure().directory(envDir).ignoreIfMissing().load();
                dotenv.entries().forEach(entry -> {
                    if (System.getProperty(entry.getKey()) == null) {
                        System.setProperty(entry.getKey(), entry.getValue());
                    }
                });
            }
        } catch (Exception e) {
            // Ignore missing or malformed .env, let Spring rely on existing system properties or defaults
        }
    }
}
