package com.test.test;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class DevToolboxApplication {

	public static void main(String[] args)
	{
		// .env 파일은 spring-dotenv 가 자동 로드한다.
		SpringApplication.run(DevToolboxApplication.class, args);
	}

}
