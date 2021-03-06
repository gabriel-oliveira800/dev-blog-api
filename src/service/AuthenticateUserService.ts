import axios from "axios";
import { sign } from "jsonwebtoken";
import { Strings } from "../helpers";
import prismaClient from "../prisma";

interface AccessTokenResponse {
  access_token: string;
}

interface IUserResponse {
  id: number;
  name: string;
  login: string;
  avatar_url: string;
  followers: number;
  following: number;
  public_repos: number;
}

class AuthenticateUserService {
  async execute(code: string) {
    const options = {
      headers: { Accept: "application/json" },
      params: {
        code,
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
      },
    };

    const { data: AccessTokenResponse } = await axios.post<AccessTokenResponse>(
      Strings.gitHubAccessTokenUrl,
      null,
      options
    );

    const response = await axios.get<IUserResponse>(
      Strings.gitHubApiUrl("/user"),
      {
        headers: {
          authorization: `Bearer ${AccessTokenResponse.access_token}`,
        },
      }
    );

    const { id, login, name, avatar_url, followers, following, public_repos } =
      response.data;

    let user = await prismaClient.user.findFirst({
      where: { github_id: id },
    });

    if (!user) {
      user = await prismaClient.user.create({
        data: {
          github_id: id,
          avatar_url,
          login,
          followers,
          following,
          public_repos,
          name: name || login,
        },
      });
    }

    const token = sign(
      {
        user: {
          id: user.id,
          login: user.login,
          name: user.name,
          avatar_url: user.avatar_url,
        },
      },
      process.env.JWT_SECRET,
      {
        subject: user.id,
        expiresIn: "1d",
      }
    );

    return { token, user };
  }
}

export { AccessTokenResponse, AuthenticateUserService };
