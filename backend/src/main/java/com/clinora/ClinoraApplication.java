package com.clinora;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ClinoraApplication {

    public static void main(String[] args) {
        SpringApplication.run(ClinoraApplication.class, args);
    }
}
