package com.doll.gacha;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.core.env.Environment;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.scheduling.annotation.EnableScheduling;

@Slf4j
@SpringBootApplication
@EnableScheduling
public class DemoApplication {

	public static void main(String[] args)
	{
		// .env 파일 로드
		ConfigurableApplicationContext context = SpringApplication.run(DemoApplication.class, args);

		// 환경 변수 로드 확인 (실제 값은 로그에 남기지 않고 설정 여부만 표기)
		Environment env = context.getEnvironment();
		log.info("환경 변수 로드 확인 - KAKAO_CLIENT_ID: {}, GOOGLE_CLIENT_ID: {}, JWT_SECRET_KEY: {}",
				isSet(env, "KAKAO_CLIENT_ID"), isSet(env, "GOOGLE_CLIENT_ID"), isSet(env, "JWT_SECRET_KEY"));
	}

	private static String isSet(Environment env, String key) {
		return env.getProperty(key) != null ? "설정됨" : "설정안됨";
	}

}
