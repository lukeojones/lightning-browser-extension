import ConfirmOrCancel from "@components/ConfirmOrCancel";
import Container from "@components/Container";
import ContentMessage from "@components/ContentMessage";
import PublisherCard from "@components/PublisherCard";
import { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useNavigationState } from "~/app/hooks/useNavigationState";
import { USER_REJECTED_ERROR } from "~/common/constants";
import api from "~/common/lib/api";
import msg from "~/common/lib/msg";
import type { LNURLAuthServiceResponse } from "~/types";

function LNURLAuth() {
  const navigate = useNavigate();

  const navState = useNavigationState();
  const details = navState.args?.lnurlDetails as LNURLAuthServiceResponse & {
    url: string;
  };

  const { t } = useTranslation("components", {
    keyPrefix: "confirmOrCancel",
  });

  async function confirm() {
    const response = await api.lnurlAuth({
      origin: navState.origin,
      lnurlDetails: details,
      options: {
        confirmed: true,
        remember: true,
        isPrompt: !!navState.isPrompt,
      },
    });

    if (navState.isPrompt) {
      return await msg.reply(response);
    } else {
      navigate(-1);
    }
  }

  function reject(e: MouseEvent) {
    e.preventDefault();
    msg.error(USER_REJECTED_ERROR);
  }

  return (
    <Container isScreenView maxWidth="sm">
      <div>
        <PublisherCard
          title={navState.origin.name}
          image={navState.origin.icon}
          url={details.domain}
        />
        <ContentMessage
          heading={`${navState.origin.name} asks you to login to`}
          content={details.domain}
        />
      </div>

      <div>
        <ConfirmOrCancel label="Login" onConfirm={confirm} onCancel={reject} />

        <p className="mb-4 text-center text-sm text-gray-400">
          <em>{t("only_trusted")}</em>
        </p>
      </div>
    </Container>
  );
}

export default LNURLAuth;
