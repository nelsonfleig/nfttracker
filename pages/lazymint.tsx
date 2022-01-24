import React, { useState } from 'react';
import { MoralisFileSaveOptions, useMoralis } from 'react-moralis';
import { useDispatch } from 'react-redux';
import { useAppSelector } from 'state/hooks';
import ContentWrapper from '../components/contentWrapper';
import MintForm from '../components/mintForm';
import Modal from '../components/modal';
import TxStatus from '../components/txStatus';
import { changeResponse, changeTxStatus } from '../state/actions';

const LazyMintPage = () => {
  const dispatch = useDispatch();

  const [showModal, setShowModal] = useState(false);
  const { Moralis, account } = useMoralis();
  const { response } = useAppSelector(state => state);

  const handleSubmit = async (e, file, name, description) => {
    e.preventDefault();
    setShowModal(true);
    dispatch(changeTxStatus('pending'));

    try {
      await (Moralis as any).enableWeb3();
      // Upload image to IPFS

      type MoralisFile = typeof Moralis.File & {
        hash: () => string;
        saveIPFS: (options?: MoralisFileSaveOptions & { useMasterKey: boolean }) => Promise<File>;
      };

      const imageFile = new Moralis.File(file.name, file) as unknown as MoralisFile;
      await imageFile.saveIPFS({ useMasterKey: true });
      const hash = imageFile.hash();

      // Create metadata
      const metadata = {
        name,
        description,
        image: `/ipfs/${hash}`,
      };

      // Upload metadate to IPFS
      const jsonFile = new Moralis.File('metadata.json', {
        base64: btoa(JSON.stringify(metadata)),
      }) as unknown as MoralisFile;

      await jsonFile.saveIPFS();
      const metadataHash = jsonFile.hash();

      // Upload to Rarible
      await Moralis.Plugins.rarible
        .lazyMint({
          chain: 'rinkeby',
          userAddress: account,
          tokenType: 'ERC721',
          tokenUri: `ipfs/${metadataHash}`,
          royaltiesAmount: 0,
        })
        .then((res: string) => {
          dispatch(changeResponse(res));
          dispatch(changeTxStatus('success'));
        });
    } catch (err) {
      if (err instanceof Error) {
        dispatch(changeResponse(err.message));
        dispatch(changeTxStatus('error'));
      }
    }
  };

  const message = 'NFT Successfully Minted';
  const res = response.data && response.data.result;
  const link =
    res && `https://rinkeby.rarible.com/token/flow/${res.tokenAddress}:${res.tokenId}?tab=details`;
  const linkText = 'View on Rarible';

  return (
    <ContentWrapper>
      <MintForm title="LazyMint NFT on Rarible" handleSubmit={handleSubmit} />

      <Modal show={showModal} cancel={() => setShowModal(false)}>
        <TxStatus message={message} res={res} link={link} linkText={linkText} />
      </Modal>
    </ContentWrapper>
  );
};
export default LazyMintPage;
