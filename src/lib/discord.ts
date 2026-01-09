'use server';

import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const PROTARDIO_CONTRACT = process.env.PROTARDIO_CONTRACT_ADDRESS as `0x${string}`;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

const CITIZEN_ROLE_NAME = 'Protardio Citizen';

// Viem client for Base chain
const viemClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org')
});

// ERC-721 balanceOf ABI
const ERC721_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }]
  }
] as const;

/**
 * Check if a wallet holds Protardio NFT
 */
export async function checkProtardioOwnership(wallet: string): Promise<boolean> {
  try {
    const balance = await viemClient.readContract({
      address: PROTARDIO_CONTRACT,
      abi: ERC721_ABI,
      functionName: 'balanceOf',
      args: [wallet as `0x${string}`]
    });
    return balance > 0n;
  } catch (error) {
    console.error('Error checking NFT ownership:', error);
    return false;
  }
}

/**
 * Get Protardio NFT balance for a wallet
 */
export async function getProtardioBalance(wallet: string): Promise<number> {
  try {
    const balance = await viemClient.readContract({
      address: PROTARDIO_CONTRACT,
      abi: ERC721_ABI,
      functionName: 'balanceOf',
      args: [wallet as `0x${string}`]
    });
    return Number(balance);
  } catch (error) {
    console.error('Error getting NFT balance:', error);
    return 0;
  }
}

/**
 * Generate Discord OAuth URL
 */
export function getDiscordAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID!,
    redirect_uri: DISCORD_REDIRECT_URI!,
    response_type: 'code',
    scope: 'identify',
    state
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

/**
 * Exchange Discord OAuth code for access token
 */
export async function exchangeDiscordCode(code: string): Promise<{ access_token: string } | null> {
  try {
    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID!,
        client_secret: DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI!
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!response.ok) {
      console.error('Failed to exchange code:', await response.text());
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Error exchanging Discord code:', error);
    return null;
  }
}

/**
 * Get Discord user info from access token
 */
export async function getDiscordUser(accessToken: string): Promise<{ id: string; username: string } | null> {
  try {
    const response = await fetch('https://discord.com/api/users/@me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      console.error('Failed to get Discord user:', await response.text());
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Error getting Discord user:', error);
    return null;
  }
}

/**
 * Assign Protardio Citizen role to a Discord user
 */
export async function assignCitizenRole(discordId: string): Promise<boolean> {
  try {
    // First, get the guild roles to find the Citizen role
    const rolesResponse = await fetch(
      `https://discord.com/api/guilds/${DISCORD_GUILD_ID}/roles`,
      {
        headers: {
          'Authorization': `Bot ${DISCORD_BOT_TOKEN}`
        }
      }
    );

    if (!rolesResponse.ok) {
      console.error('Failed to fetch guild roles:', await rolesResponse.text());
      return false;
    }

    const roles = await rolesResponse.json() as { id: string; name: string }[];
    const citizenRole = roles.find(r => r.name === CITIZEN_ROLE_NAME);

    if (!citizenRole) {
      console.error('Citizen role not found');
      return false;
    }

    // Assign the role to the user
    const assignResponse = await fetch(
      `https://discord.com/api/guilds/${DISCORD_GUILD_ID}/members/${discordId}/roles/${citizenRole.id}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!assignResponse.ok && assignResponse.status !== 204) {
      console.error('Failed to assign role:', await assignResponse.text());
      return false;
    }

    console.log(`Assigned ${CITIZEN_ROLE_NAME} role to user ${discordId}`);
    return true;
  } catch (error) {
    console.error('Error assigning citizen role:', error);
    return false;
  }
}

/**
 * Remove Protardio Citizen role from a Discord user
 */
export async function removeCitizenRole(discordId: string): Promise<boolean> {
  try {
    const rolesResponse = await fetch(
      `https://discord.com/api/guilds/${DISCORD_GUILD_ID}/roles`,
      {
        headers: {
          'Authorization': `Bot ${DISCORD_BOT_TOKEN}`
        }
      }
    );

    if (!rolesResponse.ok) {
      return false;
    }

    const roles = await rolesResponse.json() as { id: string; name: string }[];
    const citizenRole = roles.find(r => r.name === CITIZEN_ROLE_NAME);

    if (!citizenRole) {
      return false;
    }

    const removeResponse = await fetch(
      `https://discord.com/api/guilds/${DISCORD_GUILD_ID}/members/${discordId}/roles/${citizenRole.id}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bot ${DISCORD_BOT_TOKEN}`
        }
      }
    );

    return removeResponse.ok || removeResponse.status === 204;
  } catch (error) {
    console.error('Error removing citizen role:', error);
    return false;
  }
}
